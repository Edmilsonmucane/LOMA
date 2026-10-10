'use client';
import { useEffect, useId, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
export function CommunicationSearch({
  label,
  initial,
}: {
  label: string;
  initial: string;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (input.current && document.activeElement !== input.current)
      input.current.value = initial;
  }, [initial]);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        ref={input}
        id={id}
        name="q"
        defaultValue={initial}
        maxLength={150}
        type="search"
        onChange={(e) => {
          if (timer.current) clearTimeout(timer.current);
          const text = e.target.value;
          timer.current = setTimeout(() => {
            const q = new URLSearchParams(params);
            if (text) q.set('q', text);
            else q.delete('q');
            router.replace(`${path}?${q}`, { scroll: false });
          }, 250);
        }}
      />
    </>
  );
}
