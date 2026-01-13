export const createScrubber = (secrets: string[]) => {
  const validSecrets = secrets.filter((s) => s && s.length >= 3);

  return (log: string) => {
    let cleaned = log;
    for (const secret of validSecrets) {
      cleaned = cleaned.split(secret).join('[REDACTED]');
    }
    return cleaned;
  };
};
