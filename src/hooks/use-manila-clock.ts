import { useEffect, useState } from 'react';

const manilaTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function useManilaClock(): string {
  const [time, setTime] = useState(() => manilaTime.format(new Date()));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTime(manilaTime.format(new Date()));
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  return time;
}
