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
  upload.findPreviousUploads().then(function(previousUploads) {
    if (previousUploads.length) {
      upload.resumeFromPreviousUpload(previousUploads[0]);
    }
    upload.start();
  });
}

(function setup() {
  const el = document.getElementById('file');
  el.addEventListener('change', (e) => {
    const file = e.target.files[0];
    uploadFile(file);
  });
})();

export {};
