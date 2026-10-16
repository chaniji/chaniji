// Smaller UI + pages than the 1.6 system scale
user_pref("layout.css.devPixelsPerPx", "1.5");

// Show the extensions menu button.
user_pref("extensions.unifiedExtensions.button.always_visible", true);

// Load chrome/userChrome.css (it hides extensions from the menu).
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
user_pref("zen.tab-unloader.enabled", true);
user_pref("zen.tab-unloader.timeout-minutes", 10);
user_pref("browser.tabs.unloadOnLowMemory", true);

// Sidebar on the right side
user_pref("zen.tabs.vertical.right-side", true);
