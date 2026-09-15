import { useState, useEffect } from 'react';

// In-memory кеш фіче-флагів
let featureCache: Record<string, boolean> | null = null;

export const useFeature = (flagKey: string): boolean => {
  const [isEnabled, setIsEnabled] = useState<boolean>(featureCache ? !!featureCache[flagKey] : false);

  useEffect(() => {
    if (featureCache) return;
    fetch('/api/core/features')
      .then(res => res.json())
      .then(data => {
        featureCache = data.flags || {};
        setIsEnabled(!!featureCache![flagKey]);
      })
      .catch(err => console.error('Failed to load feature flags', err));
  }, [flagKey]);

  return isEnabled;
};
