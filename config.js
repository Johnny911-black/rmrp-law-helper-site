/** Настройте перед публикацией на GitHub */
window.SITE_CONFIG = {
  /** Репозиторий, где лежат Releases с .exe (может быть отдельным от сайта) */
  githubUser: 'Johnny911-black',
  githubRepo: 'rmrp-law-helper',
  /** Версия приложения на сайте (пока нет Release на GitHub — или как fallback) */
  appVersion: '1.0',
  /** Имя portable-zip в GitHub Releases */
  exeFileName: 'RMRP.LAW.HELPER.zip',
  /** Имя установщика для автообновления (Setup.exe + latest.yml в Release) */
  setupFileName: 'RMRP Law Helper-Setup-1.0.0.exe',
  /** Горячая клавиша по умолчанию в приложении */
  defaultHotkey: 'F9',
  /** ID видео на YouTube (из ссылки youtube.com/watch?v=XXXXXXXX) */
  youtubeVideoId: '',
  /**
   * Резервный changelog, если GitHub API недоступен.
   * При нормальной работе список берётся из описания Releases автоматически.
   */
  changelogFallback: [
    {
      version: '1.0',
      date: '2026-07-12T00:00:00Z',
      title: 'RMRP Law Helper 1.0',
      body: 'Первый публичный релиз.\n\n- Законы и правила с форума\n- Биндер, патруль, закладки\n- Overlay поверх игры',
    },
  ],
};
