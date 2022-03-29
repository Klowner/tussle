const { Upload } = require('tus-js-client');

function uploadFile(file) {
  const upload = new Upload(file, {
    endpoint: '/files',
    retryDelays: [0, 5000, 10000],
    chunkSize: 1024 * 1024 * 10, // 10MB
    parallelUploads: false,
    metadata: {
      filename: file.name,
      filetype: file.type,
      'random-metadata': Math.floor(Math.random() * 1e16).toString(16),
    },
    onError: (err) => {
      console.error(err);
      setTimeout(() => uploadFile(file), 10000); // retry in 10 seconds
    },
    onProgress: (uploaded, total) => {
      const pct = Math.floor(uploaded / total * 100);
      console.log('upload: ' + pct + '%');
    },
  });
  console.log('upload', upload);
  window.currentUpload = upload;
  return upload.start();
}

(function setup() {
  const el = document.getElementById('file');
  el.addEventListener('change', (e) => {
    const file = e.target.files[0];
    uploadFile(file);
  });
})();

export {};
