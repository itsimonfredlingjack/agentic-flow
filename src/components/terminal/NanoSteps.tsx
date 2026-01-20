"use client";

import React from 'react';
import { Check, Loader2 } from 'lucide-react';

export type NanoStepStatus = 'completed' | 'active' | 'pending' | 'blocked';

export interface NanoStep {
  id: string;
  label: string;
  status: NanoStepStatus;
}

interface NanoStepsProps {
  steps: NanoStep[];
  ariaLabel?: string;
  title?: string;
}

export function NanoSteps({ steps, ariaLabel = 'Nano-steps progress', title }: NanoStepsProps) {
  if (!steps.length) return null;

  return (
    <div className="nano-rail" role="group" aria-label={ariaLabel}>
      {title && <span className="nano-rail__title">{title}</span>}
      <div className="nano-rail__track">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const connectorState = step.status === 'completed'
            ? 'completed'
            : step.status === 'active'
              ? 'active'
              : 'pending';

          return (
            <React.Fragment key={step.id}>
              <div
                className={`nano-step nano-step--${step.status}`}
                title={`${step.label} (${step.status})`}
              >
                <span className="nano-step__icon" aria-hidden>
                  {step.status === 'completed' ? (
                    <Check className="nano-step__check" />
                  ) : step.status === 'active' ? (
                    <Loader2 className="nano-step__spinner" />
                  ) : (
                    <span className="nano-step__dot" />
                  )}
                </span>
                <span className="nano-step__label">{step.label}</span>
              </div>
              {!isLast && (
                <span
                  className={`nano-step__connector nano-step__connector--${connectorState}`}
                  aria-hidden
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
