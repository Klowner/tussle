const { Upload } = require('tus-js-client');

function uploadFile(file) {
  const upload = new Upload(file, {
    endpoint: 'http://localhost:8080/files',
    retryDelays: [0, 1000, 3000, 5000],
    metadata: {
      filename: file.name,
      filetype: file.type,
    },
    onError: (err) => {
      console.error(err);
      setTimeout(() => uploadFile(file), 2000); // retry in 5 seconds
    },
  });
  return upload.start();
}

(function setup() {
  const el = document.getElementById('file');
  el.addEventListener('change', (e) => {
    const file = e.target.files[0];
    uploadFile(file);
  });
})();
