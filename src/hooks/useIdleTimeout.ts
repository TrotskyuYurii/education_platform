import { useCallback, useEffect, useRef, useState } from 'react';

/** Скільки часу тримати сесію без дій користувача (запасне значення, поки сервер не відповів). */
const DEFAULT_IDLE_TIMEOUT_SECONDS = 30 * 60;
const DEFAULT_WARNING_SECONDS = 60;

/** Спільний для всіх вкладок момент останньої активності. */
const LAST_ACTIVITY_KEY = 'viatec_last_activity';

/**
 * Події вважаємо активністю лише навмисні. `mousemove` свідомо відсутній:
 * випадковий поштовх столу не має продовжувати сесію, інакше таймаут нічого
 * не захищає на робочому місці, яке людина залишила.
 */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;

/** Як часто пишемо активність у localStorage — щоб не смикати диск на кожну клавішу. */
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
/** Як часто продовжуємо сесію на сервері за наявності активності. */
const HEARTBEAT_THROTTLE_MS = 60_000;

const readSharedActivity = (): number | null => {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const writeSharedActivity = (at: number) => {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    /* приватний режим або заповнене сховище — працюємо в межах вкладки */
  }
};

export const clearSharedActivity = () => {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {}
};

export interface IdleTimeoutOptions {
  /** Вимкнено, доки користувач не увійшов. */
  enabled: boolean;
  idleTimeoutSeconds?: number;
  warningSeconds?: number;
  /** Викликається один раз, коли ліміт простою вичерпано. */
  onTimeout: () => void;
}

export interface IdleTimeoutState {
  /** Показувати попередження про швидкий вихід. */
  warningActive: boolean;
  /** Скільки секунд лишилось до автоматичного виходу (0, якщо попередження неактивне). */
  secondsLeft: number;
  /** Явне продовження сесії з вікна попередження. */
  extendSession: () => void;
}

/**
 * Таймаут бездіяльності: рахує час від останньої дії користувача, за хвилину
 * до кінця показує попередження, а потім виходить із застосунку.
 *
 * Відлік спільний для всіх відкритих вкладок (через localStorage), тож робота
 * в одній вкладці не дає іншим «протухнути» і вилогінити людину посеред справи.
 */
export function useIdleTimeout({
  enabled,
  idleTimeoutSeconds = DEFAULT_IDLE_TIMEOUT_SECONDS,
  warningSeconds = DEFAULT_WARNING_SECONDS,
  onTimeout
}: IdleTimeoutOptions): IdleTimeoutState {
  const [warningActive, setWarningActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef = useRef<number>(0);
  const lastHeartbeatRef = useRef<number>(Date.now());
  const warningActiveRef = useRef(false);
  const timedOutRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const timeoutMs = Math.max(60, idleTimeoutSeconds) * 1000;
  const warningMs = Math.min(Math.max(10, warningSeconds) * 1000, Math.floor(timeoutMs / 2));

  const sendHeartbeat = useCallback(() => {
    lastHeartbeatRef.current = Date.now();
    fetch('/api/auth/heartbeat', { method: 'POST' })
      .then(res => {
        // Сервер уже закрив сесію (наприклад, годинники розійшлись або куку
        // очистили) — немає сенсу вдавати, що користувач досі всередині.
        if (res.status === 401 && !timedOutRef.current) {
          timedOutRef.current = true;
          clearSharedActivity();
          onTimeoutRef.current();
        }
      })
      .catch(() => {
        /* мережевий збій не має вилогінювати: наступна дія спробує ще раз */
      });
  }, []);

  const registerActivity = useCallback(
    (options?: { force?: boolean }) => {
      const now = Date.now();
      lastActivityRef.current = now;

      if (options?.force || now - lastWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        writeSharedActivity(now);
      }

      // Сервер тримає токен рівно на час простою, тож його теж треба продовжити —
      // але не частіше ніж раз на хвилину, щоб не слати запит на кожен клік.
      if (options?.force || now - lastHeartbeatRef.current >= HEARTBEAT_THROTTLE_MS) {
        sendHeartbeat();
      }
    },
    [sendHeartbeat]
  );

  const extendSession = useCallback(() => {
    if (timedOutRef.current) return;
    warningActiveRef.current = false;
    setWarningActive(false);
    setSecondsLeft(0);
    registerActivity({ force: true });
  }, [registerActivity]);

  useEffect(() => {
    if (!enabled) {
      warningActiveRef.current = false;
      timedOutRef.current = false;
      setWarningActive(false);
      setSecondsLeft(0);
      return;
    }

    // Вхід у застосунок — це теж активність; стартуємо відлік з чистого аркуша.
    timedOutRef.current = false;
    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = Date.now();
    lastWriteRef.current = Date.now();
    writeSharedActivity(lastActivityRef.current);

    const handleActivity = () => {
      // Поки висить попередження, звичайні дії його не знімають: людина має
      // свідомо підтвердити, що вона на місці, — інакше сенс попередження зникає.
      if (warningActiveRef.current) return;
      registerActivity();
    };

    ACTIVITY_EVENTS.forEach(event =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    const tick = () => {
      const shared = readSharedActivity();
      // Активність у сусідній вкладці рахується як своя.
      if (shared && shared > lastActivityRef.current) {
        lastActivityRef.current = shared;
        if (warningActiveRef.current) {
          warningActiveRef.current = false;
          setWarningActive(false);
          setSecondsLeft(0);
        }
      }

      const idleMs = Date.now() - lastActivityRef.current;
      const remainingMs = timeoutMs - idleMs;

      if (remainingMs <= 0) {
        if (timedOutRef.current) return;
        timedOutRef.current = true;
        warningActiveRef.current = false;
        setWarningActive(false);
        setSecondsLeft(0);
        clearSharedActivity();
        onTimeoutRef.current();
        return;
      }

      if (remainingMs <= warningMs) {
        warningActiveRef.current = true;
        setWarningActive(true);
        setSecondsLeft(Math.ceil(remainingMs / 1000));
      } else if (warningActiveRef.current) {
        warningActiveRef.current = false;
        setWarningActive(false);
        setSecondsLeft(0);
      }
    };

    const intervalId = window.setInterval(tick, 1000);
    // Повернення до вкладки після сну системи має перерахувати простій одразу.
    document.addEventListener('visibilitychange', tick);

    return () => {
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, handleActivity));
      document.removeEventListener('visibilitychange', tick);
      window.clearInterval(intervalId);
    };
  }, [enabled, timeoutMs, warningMs, registerActivity]);

  return { warningActive, secondsLeft, extendSession };
}
