import React from 'react';

export function Spinner() {
  return <div className="center muted">Loading…</div>;
}

export function ErrorText({ message }: { message: string }) {
  return <div className="error-text">{message}</div>;
}

export function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>;
}

export function Bool({ value }: { value: boolean }) {
  return value ? <span className="check">✓</span> : <span className="cross">✕</span>;
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
