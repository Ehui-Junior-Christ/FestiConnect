// Demarrage "production" : applique les migrations (idempotentes) puis lance le serveur,
// dans UN SEUL processus Node pour que SIGTERM arrive directement au serveur
// (pas de shell intermediaire `sh -c "a && b"` qui avalerait le signal).
//
// Utilise par le Dockerfile et par les hebergeurs sans etape "pre-deploy".
// Mettre RUN_MIGRATIONS=false pour sauter les migrations (ex. si elles sont
// deja lancees pendant le build, comme sur Render).

const runMigrations = !['false', '0', 'no'].includes(
  String(process.env.RUN_MIGRATIONS ?? 'true').toLowerCase()
);

if (runMigrations) {
  try {
    await import('../src/db/migrate.js');
  } catch (error) {
    console.error('Echec des migrations, arret du demarrage :', error?.message || error);
    process.exit(1);
  }
} else {
  console.log('RUN_MIGRATIONS=false : migrations ignorees.');
}

await import('../server.js');
