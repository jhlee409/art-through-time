function requireUrlFileDownloadApproval(context = {}) {
  const approved = process.env.ART_ATLAS_URL_FILE_DOWNLOAD_APPROVED === 'yes';
  const note = String(process.env.ART_ATLAS_URL_FILE_DOWNLOAD_APPROVAL_NOTE || '').trim();
  if (!approved || !note) {
    const purpose = context.purpose ? `\nPurpose: ${context.purpose}` : '';
    const url = context.url ? `\nURL: ${context.url}` : '';
    throw new Error(
      `URL file download is blocked until the user explicitly approves it.${purpose}${url}\n` +
      'After approval, rerun with ART_ATLAS_URL_FILE_DOWNLOAD_APPROVED=yes and ART_ATLAS_URL_FILE_DOWNLOAD_APPROVAL_NOTE set.'
    );
  }
}

module.exports = {requireUrlFileDownloadApproval};
