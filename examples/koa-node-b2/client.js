const { Upload } = require('tus-js-client');

function uploadFile(file) {
  const upload = new Upload(file, {
    endpoint: '/files/',
    retryDelays: [0, 1000, 3000, 5000],
    chunkSize: 1000 * 1000 * 100,
    parallelUploads: 1,
    metadata: {
      filename: file.name,
      filetype: file.type,
      'random-metadata': Math.floor(Math.random() * 1e16).toString(16),
    },
    onError: (err) => {
      console.error(err);
      setTimeout(() => uploadFile(file), 2000); // retry in 5 seconds
    },
    onProgress: (uploaded, total) => {
      const pct = Math.floor(uploaded / total * 100);
      console.log('upload: ' + pct + '%');
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
