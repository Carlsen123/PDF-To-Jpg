const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

// Folder sementara tempat hasil konversi disimpan per-job
const JOBS_DIR = path.join(os.tmpdir(), 'paperworks-jobs');
fs.mkdirSync(JOBS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('File harus berformat PDF.'));
    }
    cb(null, true);
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Hapus folder job setelah 30 menit supaya tidak menumpuk
function scheduleCleanup(jobDir) {
  setTimeout(() => {
    fs.rm(jobDir, { recursive: true, force: true }, () => {});
  }, 30 * 60 * 1000);
}

app.post('/api/convert', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file PDF yang diupload.' });
    }

    const jobId = crypto.randomUUID();
    const jobDir = path.join(JOBS_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const inputPath = path.join(jobDir, 'input.pdf');
    fs.writeFileSync(inputPath, req.file.buffer);

    const outputPrefix = path.join(jobDir, 'page');

    // pdftoppm dari poppler-utils: render tiap halaman PDF jadi JPG
    execFile('pdftoppm', ['-jpeg', '-r', '150', inputPath, outputPrefix], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: 'Gagal mengonversi PDF. Pastikan file tidak rusak atau terkunci password.'
        });
      }

      const files = fs.readdirSync(jobDir)
        .filter(f => f.endsWith('.jpg'))
        .sort((a, b) => {
          const na = parseInt(a.match(/-(\d+)\.jpg$/)?.[1] || '0', 10);
          const nb = parseInt(b.match(/-(\d+)\.jpg$/)?.[1] || '0', 10);
          return na - nb;
        });

      if (files.length === 0) {
        return res.status(500).json({ error: 'Tidak ada halaman yang berhasil dikonversi.' });
      }

      scheduleCleanup(jobDir);

      res.json({
        jobId,
        pages: files.map((f, i) => ({
          index: i + 1,
          url: `/api/preview/${jobId}/${f}`
        }))
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
});

// Serve gambar satu halaman (untuk preview & download per-halaman)
app.get('/api/preview/:jobId/:filename', (req, res) => {
  const { jobId, filename } = req.params;
  if (!/^[a-f0-9-]+$/.test(jobId) || !/^page-\d+\.jpg$/.test(filename)) {
    return res.status(400).end();
  }
  const filePath = path.join(JOBS_DIR, jobId, filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

// Download semua halaman sebagai satu file ZIP
app.get('/api/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  if (!/^[a-f0-9-]+$/.test(jobId)) return res.status(400).end();
  const jobDir = path.join(JOBS_DIR, jobId);
  if (!fs.existsSync(jobDir)) return res.status(404).end();

  res.attachment('hasil-konversi.zip');
  const archive = archiver('zip');
  archive.pipe(res);
  archive.glob('page-*.jpg', { cwd: jobDir });
  archive.finalize();
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Ukuran file maksimal 100 MB.' });
  }
  res.status(400).json({ error: err.message || 'Upload gagal.' });
});

app.listen(PORT, () => {
  console.log(`Paperworks PDF→JPG berjalan di http://localhost:${PORT}`);
});
