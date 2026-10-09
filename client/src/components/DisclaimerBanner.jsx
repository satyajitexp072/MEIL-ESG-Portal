import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

export default function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
        <span>
          <strong>Assurance Notice:</strong> This platform assists ESG data aggregation, mathematical calculation, and audit traceability under GHG Protocol and SEBI BRSR guidelines. It serves internal corporate governance and <u>does not substitute</u> accredited third-party statutory assurance under ISAE 3000 / AA1000.
        </span>
      </div>
      <span className="hidden md:inline-flex items-center text-amber-700 font-mono text-[11px] bg-amber-100/70 px-2 py-0.5 rounded border border-amber-300">
        SEBI BRSR Section C Compliant
      </span>
    </div>
  );
}
