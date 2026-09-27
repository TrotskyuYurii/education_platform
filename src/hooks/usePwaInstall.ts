import { useEffect, useState } from 'react';
import { canPromptInstall, isStandaloneApp, promptInstall, subscribeInstallAvailability } from '../utils/pwa';

/** Стан кнопки «Встановити додаток»: чи доступна вона і що робить. */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(canPromptInstall);

  useEffect(() => subscribeInstallAvailability(() => setCanInstall(canPromptInstall())), []);

  return {
    canInstall: canInstall && !isStandaloneApp(),
    isInstalled: isStandaloneApp(),
    install: promptInstall
  };
}
