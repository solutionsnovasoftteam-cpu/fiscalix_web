"use client";

import { useRef, type FormEvent, type FormHTMLAttributes, type ReactNode } from "react";

type AutoSubmitFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "onChange"> & {
  children: ReactNode;
};

/**
 * Sends a GET filter form as soon as one of its fields changes.
 * The regular submit button remains available as a progressive-enhancement fallback.
 */
export function AutoSubmitForm({ children, ...props }: AutoSubmitFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
      formRef.current?.requestSubmit();
    }
  }

  return <form {...props} ref={formRef} onChange={handleChange}>{children}</form>;
}
