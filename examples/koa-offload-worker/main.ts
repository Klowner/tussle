import { Upload } from 'tus-js-client';

function addEventListeners(): void {
  const el = document.getElementById('file');
  el.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files[0];
    console.log('sending', file.name, file.type);
    const upload = new Upload(file, {
      endpoint: 'http://localhost:8080/files',
      retryDelays: [0, 1000],
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      onError: (err) => {
        console.log('failed', err);
      }
    });
    upload.start();
  });
}
addEventListeners();
