const { Upload } = require('tus-js-client');

function uploadFile(file) {
  const upload = new Upload(file, {
    endpoint: '/files', // the cloudflare worker should be running at this URL
    retryDelays: [0, 5000],
    chunkSize: 1000 * 1000 * 8, // 8MB (cloudflare multi-part upload chunks must be at least 5MB!)
    parallelUploads: 1,
    metadata: {
      filename: file.name,
      filetype: file.type,
      'random-metadata': Math.floor(Math.random() * 1e16).toString(16),
    },
    onError: (err) => {
      console.error(err);
    },
    onProgress: (uploaded, total) => {
      const pct = Math.floor(uploaded / total * 100);
      console.log('upload: ' + pct + '%');
    },
    onChunkComplete: (size, bytesComplete, bytesTotal) => {
      console.log(`chunk completed: ${bytesComplete} bytes`);
    },
    onSuccess: () => {
      console.log('upload success!');
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
