document.addEventListener('DOMContentLoaded', () => {
  const hostBadge = document.getElementById('host-badge');
  const accountInfo = document.getElementById('account-info');
  const pairingBox = document.getElementById('pairing-box');
  const pairingCodeInput = document.getElementById('pairing-code');
  const profileRoleSelect = document.getElementById('profile-role');
  const submitPairingBtn = document.getElementById('submit-pairing');
  const pairingResult = document.getElementById('pairing-result');

  function refresh() {
    chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
      if (!res) return;
      if (res.isConnected) {
        hostBadge.textContent = 'Native Host Connected';
        hostBadge.className = 'badge badge-online';
      } else {
        hostBadge.textContent = 'Native Host Disconnected';
        hostBadge.className = 'badge badge-offline';
      }

      if (res.pairingState === 'VERIFYING') {
        accountInfo.innerHTML = '<div style="color: #facc15; font-weight: 600;">Verifying saved pairing…</div>';
        pairingBox.style.display = 'none';
      } else if (res.enrolledProfile && res.enrolledProfile.verified && res.pairingState === 'PAIRED') {
        accountInfo.innerHTML = `
          <div style="color: #38bdf8; font-weight: 600;">Authorized Profile Paired</div>
          <div style="margin-top: 4px;">Role: <b>${res.enrolledProfile.role.toUpperCase()}</b></div>
          <div style="font-family: monospace; color: #a5f3fc;">${res.enrolledProfile.email}</div>
          <div style="margin-top: 6px; font-size: 11px; color: #64748b;">Maryam Active Tabs: ${res.ownedTabsCount || 0}</div>
        `;
        pairingBox.style.display = 'none';
      } else {
        accountInfo.innerHTML = `
          <div style="color: #f87171; font-weight: 600;">Not Enrolled / Unpaired</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Only Mohsin's 2 authorized profiles may pair with Maryam.</div>
        `;
        pairingBox.style.display = 'block';
      }
    });
  }

  submitPairingBtn.addEventListener('click', () => {
    const code = pairingCodeInput.value.trim();
    const role = profileRoleSelect.value;
    if (!code) {
      pairingResult.textContent = 'Please enter a pairing secret.';
      pairingResult.style.color = '#f87171';
      return;
    }

    pairingResult.textContent = 'Verifying with Local Runner...';
    pairingResult.style.color = '#38bdf8';

    chrome.runtime.sendMessage({
      action: 'SUBMIT_PAIRING',
      pairingSecret: code,
      profileRole: role
    }, (res) => {
      if (res && res.success) {
        pairingResult.textContent = `Paired successfully as ${res.profileEmail}!`;
        pairingResult.style.color = '#34d399';
        setTimeout(refresh, 1000);
      } else {
        pairingResult.textContent = res?.error || 'Pairing failed. Invalid secret.';
        pairingResult.style.color = '#f87171';
      }
    });
  });

  refresh();
  setInterval(refresh, 2000);
});
