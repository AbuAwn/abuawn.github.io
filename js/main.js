function setLanguage(lang) {
    if (!['es', 'en', 'ar'].includes(lang)) return;

    // Save preference
    localStorage.setItem('preferredLang', lang);

    // Update Body Class
    document.body.className = ''; // reset
    document.body.classList.add(lang);

    // Update DOM Language
    document.documentElement.lang = lang;

    // Update Direction
    if (lang === 'ar') {
        document.body.dir = 'rtl';
    } else {
        document.body.dir = 'ltr';
    }

    // Update Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.lang === lang) {
            btn.classList.add('active');
        }
    });
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'es';
    setLanguage(savedLang);

    // Bind Click Events
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setLanguage(e.target.dataset.lang);
        });
    });
});
