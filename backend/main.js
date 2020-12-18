require('dotenv').config();
const morgan = require('morgan');
const express = require('express');
const sha1 = require('sha-1');
const mysql = require('mysql2/promise');

const multer = require('multer');
const { MongoClient } = require('mongodb');
const AWS = require('aws-sdk');
const fs = require('fs');

// Make "temp" directory as multer.diskStorage wont create folder
fs.mkdir('./temp', { recursive: true }, (err) => {
  if (err) throw err;
});

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000;
// Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './temp');
  },
  filename: function (req, file, cb) {
    let extArray = file.mimetype.split('/');
    let extension = extArray[extArray.length - 1];
    cb(null, new Date().getTime() + '.' + extension);
  },
});
const upload = multer({ storage: storage });
// AWS
const AWS_S3_HOSTNAME = process.env.AWS_S3_HOSTNAME;
const AWS_S3_ACCESSKEY_ID = process.env.AWS_S3_ACCESSKEY_ID;
const AWS_S3_SECRET_ACCESSKEY = process.env.AWS_S3_SECRET_ACCESSKEY;
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

const endpoint = new AWS.Endpoint(AWS_S3_HOSTNAME);
const s3 = new AWS.S3({
  endpoint,
  accessKeyId: AWS_S3_ACCESSKEY_ID,
  secretAccessKey: AWS_S3_SECRET_ACCESSKEY,
});

const readFile = (path) =>
  new Promise((resolve, reject) =>
    fs.readFile(path, (err, buff) => {
      if (null != err) reject(err);
      else resolve(buff);
    })
  );

const putObject = (file, buff, s3) =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: AWS_S3_BUCKET_NAME,
      Key: file.filename,
      Body: buff,
      ACL: 'public-read',
      ContentType: file.mimetype,
      ContentLength: file.size,
    };
    s3.putObject(params, (err, result) => {
      if (null != err) reject(err);
      else resolve(file.filename);
    });
  });

const p0 = new Promise((resolve, reject) => {
  s3.headBucket(
    {
      Bucket: AWS_S3_BUCKET_NAME,
    },
    function (err, data) {
      if (err) {
        console.log(err, err.stack);
        reject(err);
      } else {
        resolve('success');
      }
    }
  );
});
// Mongo test
const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB = process.env.MONGO_DB;
const MONGO_COLLECTION = process.env.MONGO_COLLECTION;

const mongoClient = new MongoClient(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// mongoClient.connect return a promise by default
const p2 = mongoClient.connect();
// MYSQL test
const pool = mysql.createPool({
  connectionLimit: process.env.SQL_CON_LIMIT,
  host: process.env.SQL_SERVER,
  port: process.env.SQL_PORT,
  user: process.env.SQL_USERNAME,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_SCHEME,
  timezone: process.env.SQL_TIMEZONE,
});

const p1 = (async () => {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  return true;
})();

const makeQuery = (query, pool) => {
  return async (args) => {
    const conn = await pool.getConnection();
    try {
      let results = await conn.query(query, args || []);
      return results[0];
    } catch (error) {
      console.log(error);
    } finally {
      conn.release();
    }
  };
};

const queryCheckLogin =
  'SELECT COUNT(*) as "match" FROM user WHERE user_id = ? AND password = ?';
const checkLogin = makeQuery(queryCheckLogin, pool);

const app = express();

app.use(morgan('combined'));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));

// For Login
app.post('/api/login', async (req, res) => {
  let { user_id, password } = req.body;
  // Obtain sha1 password from submitted password
  password = sha1(password);
  try {
    let results = await checkLogin([user_id, password]);
    // Return the credential (supposedly token) when record is matched
    if (results[0]['match'] !== 0) {
      res.status(200).json({ login: 'success', user_id, password });
    } else {
      // return 401 if record not found
      res.status(401).json({ error: 'No such username or password' });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

// For Post submission
app.post('/api/post', upload.single('imageFile'), async (req, res) => {
  let { user_id, password, comments, title } = req.body;
  try {
    let results = await checkLogin([user_id, password]);
    // Check if user is authenticated, todo(use token)
    if (results[0]['match'] !== 0) {
      readFile(req.file.path)
        .then((buff) =>
          // Insert Image to S3 upon succesful read
          putObject(req.file, buff, s3)
        )
        .then((results) => {
          // build url of the resource upon successful insertion
          const resourceURL = `https://${AWS_S3_BUCKET_NAME}.${AWS_S3_HOSTNAME}/${results}`;
          const doc = {
            comments,
            title,
            ts: new Date(),
            image: resourceURL,
          };
          mongoClient
            .db(MONGO_DB)
            .collection(MONGO_COLLECTION)
            .insertOne(doc)
            .then((results) => {
              console.log(results);
              // delete the temp file when no error from MONGO & AWS S3
              fs.unlink(req.file.path, () => {});
              // return the inserted object
              res.status(200).json(results.ops[0]);
            })
            .catch((error) => {
              console.error('Mongo insert error: ', error);
              res.status(500);
              res.json({ error });
            });
        })
        .catch((error) => {
          console.error('insert error: ', error);
          res.status(500);
          res.json({ error });
        });
    } else {
      res.status(401).json({ error: 'No credential provided' });
    }
  } catch (error) {
    res.status(500).json({ error });
  }
});

// for serving files required by Angular
app.use('/', express.static('dist/frontend'));

// for serving index html, ensure bookmarkable
app.get('*', function (req, res) {
  res.sendFile(__dirname + '/dist/frontend/index.html');
});

// test connection for SQL, MONGO, AWS S3
Promise.all([p0, p1, p2])
  .then(() => {
    app.listen(PORT, () =>
      console.info(
        `Application started on port http://localhost:${PORT}/ at ${new Date()}`
      )
    );
  })
  .catch((err) => {
    console.error('Cannot connect: ', err);
  });
