// JCN Personal Fit Studio — BodyFit scan-to-avatar UI bridge.
// Additive integration: leaves the existing GLB loader, camera capture and pricing untouched.
(() => {
  const $ = id => document.getElementById(id);
  const SIZE_SET = new Set(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']);
  let result = null;
  let avatarReady = false;

  function makeInterface() {
    const panel = $('step-you');
    const scanResults = panel?.querySelector('.scan-results');
    if (!panel || !scanResults || $('jcnFitTransfer')) return;

    const block = document.createElement('section');
    block.id = 'jcnFitTransfer';
    block.setAttribute('aria-label', 'BodyFit to 3D avatar');
    block.innerHTML = `
      <p class="jcn-fit-eyebrow">BODYFIT → REALISTIC 3D AVATAR</p>
      <p id="jcnFitTransferMessage" role="status" aria-live="polite">
        Complete the front and side scans to see a suggested clothing size.
      </p>
      <div class="jcn-fit-summary">
        <div><small>Recommended size</small><strong id="jcnFitTransferSize">—</strong></div>
        <div><small>Scan progress</small><strong id="jcnFitTransferProgress">0 / 2</strong></div>
      </div>
      <button id="jcnViewMyFit" type="button" disabled>View my 3D fit preview</button>
      <small class="jcn-fit-disclaimer">Estimated size and visual proportions only. This is not a precise body measurement or a personal 3D body scan.</small>
    `;
    scanResults.insertAdjacentElement('afterend', block);

    $('jcnViewMyFit').addEventListener('click', () => {
      if (!result || !SIZE_SET.has(result.size)) return;
      const select = $('selectedSize');
      if (!select) return;
      select.value = result.size;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('input', { bubbles: true }));
      try {
        window.JCNBodyFitStudio?.applyBodyPreview?.();
        window.JCNBodyFitStudio?.setView?.('front');
        window.JCNBodyFitStudio?.frame?.();
      } catch (error) {
        console.warn('[JCN BodyFit bridge] Preview adjustment unavailable:', error);
      }
      const viewer = $('viewer');
      viewer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const glance = $('fitGlance');
      if (glance) glance.textContent = `BodyFit suggests size ${result.size}. The avatar shows a visual approximation only; confirm the garment dimensions before ordering.`;
      $('jcnFitTransferMessage').textContent = `Suggested size ${result.size} selected. See the 360° avatar preview.`;
    });
  }

  function updateResult(detail) {
    if (!$('jcnFitTransfer')) return;
    const front = Boolean(detail?.frontCaptured);
    const side = Boolean(detail?.sideCaptured);
    const complete = front && side;
    const valid = SIZE_SET.has(detail?.size);
    result = valid ? { ...detail } : null;

    $('jcnFitTransferProgress').textContent = `${Number(front) + Number(side)} / 2`;
    $('jcnFitTransferSize').textContent = valid ? detail.size : '—';
    $('jcnViewMyFit').disabled = !valid || !avatarReady;
    $('jcnFitTransferMessage').textContent = !valid
      ? 'Waiting for a size recommendation.'
      : complete
        ? `Front and side captured. Suggested size: ${detail.size}. ${detail.confidence || 'Please check your size chart.'}`
        : `Preliminary recommendation: ${detail.size}. Finish both captures for the full workflow (or verify with manual measurements).`;

    if (complete && valid) {
      // The existing BodyFit code selects the size and the Studio pricing script
      // recalculates the quote. This event ensures custom listeners see it too.
      const select = $('selectedSize');
      if (select) {
        select.value = detail.size;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      try { window.JCNBodyFitStudio?.applyBodyPreview?.(); }
      catch (error) { console.warn('[JCN BodyFit bridge] 3D preview adjustment unavailable:', error); }
    }
  }

  function init() {
    makeInterface();
    avatarReady = Boolean(window.JCNBodyFitStudio);
    if ($('jcnViewMyFit') && result) $('jcnViewMyFit').disabled = !avatarReady;

    // Recommender emits this after selecting the estimated garment size.
    window.addEventListener('jcn:size-recommended', event => updateResult(event.detail));
    window.addEventListener('jcn:avatar-ready', () => {
      avatarReady = true;
      if ($('jcnViewMyFit') && result) $('jcnViewMyFit').disabled = false;
    });

    // Reset our display when the current scan is cleared.
    $('retakeScan')?.addEventListener('click', () => {
      result = null;
      $('jcnFitTransferSize').textContent = '—';
      $('jcnFitTransferProgress').textContent = '0 / 2';
      $('jcnFitTransferMessage').textContent = 'Ready for a new front and side scan.';
      $('jcnViewMyFit').disabled = true;
    });
  }

  // Defer scripts and ES module may execute in different turns; defer init to DOM readiness.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  const style = document.createElement('style');
  style.textContent = `
    #jcnFitTransfer { margin: 16px 0; padding: 16px; border: 1px solid #806733; border-radius: 14px; background: #191917; color: #eee7d5; }
    #jcnFitTransfer .jcn-fit-eyebrow { margin: 0 0 8px; font-size: 11px; color: #e6bb53; font-weight: 800; letter-spacing: 1.4px; }
    #jcnFitTransferMessage { margin: 0 0 12px; line-height: 1.5; font-size: 13px; }
    #jcnFitTransfer .jcn-fit-summary { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    #jcnFitTransfer .jcn-fit-summary div { flex: 1; border: 1px solid #51452e; padding: 11px; border-radius: 9px; display: grid; gap: 4px; }
    #jcnFitTransfer small { font-size: 11px; color: #bcb5a6; line-height: 1.5; }
    #jcnFitTransfer strong { font-size: 21px; color: #f6d27b; }
    #jcnViewMyFit { width: 100%; padding: 12px; border: 0; border-radius: 9px; background: #e7be58; color: #16120a; font-weight: 800; cursor: pointer; }
    #jcnViewMyFit:disabled { opacity: .5; cursor: not-allowed; }
    #jcnFitTransfer .jcn-fit-disclaimer { display: block; margin-top: 10px; }
  `;
  document.head.append(style);
})();
