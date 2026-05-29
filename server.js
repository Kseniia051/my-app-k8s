let express = require('express');
let path = require('path');
let fs = require('fs');
let MongoClient = require('mongodb').MongoClient;
let bodyParser = require('body-parser');

//  PROMETHEUS
const client = require('prom-client');

let app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* PROMETHEUS METRICS */

// базовые метрики Node.js (CPU, память и т.д.)
client.collectDefaultMetrics({ timeout: 5000 });

// счётчик HTTP запросов
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// время ответа
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

// middleware для метрик
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.path,
      status_code: res.statusCode
    });

    end({ method: req.method, route: req.path });
  });

  next();
});

// endpoint для Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

/* ТВОЁ ПРИЛОЖЕНИЕ */

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get('/profile-picture', function (req, res) {
  let img = fs.readFileSync(path.join(__dirname, "images/profile-1.jpg"));
  res.writeHead(200, { 'Content-Type': 'image/jpg' });
  res.end(img, 'binary');
});

// MongoDB URLs
let mongoUrlLocal = "mongodb://admin:password@mongodb:27017";
let mongoUrlDockerCompose = "mongodb://admin:password@mongodb";

let mongoClientOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

let databaseName = "user-account";
let collectionName = "users";

/* GET PROFILE */

app.get('/get-profile', function (req, res) {
  let response = {};

  MongoClient.connect(mongoUrlLocal, mongoClientOptions, function (err, client) {
    if (err) throw err;

    let db = client.db(databaseName);
    let myquery = { userid: 1 };

    db.collection(collectionName).findOne(myquery, function (err, result) {
      if (err) throw err;

      response = result;
      client.close();

      res.send(response ? response : {});
    });
  });
});

/* UPDATE PROFILE */

app.post('/update-profile', function (req, res) {
  let userObj = req.body;

  MongoClient.connect(mongoUrlLocal, mongoClientOptions, function (err, client) {
    if (err) throw err;

    let db = client.db(databaseName);

    userObj['userid'] = 1;

    let myquery = { userid: 1 };
    let newvalues = { $set: userObj };

    db.collection(collectionName).updateOne(
      myquery,
      newvalues,
      { upsert: true },
      function (err, result) {
        if (err) throw err;
        client.close();
      }
    );
  });

  res.send(userObj);
});

/*START SERVER */

app.listen(3000, function () {
  console.log("app listening on port 3000!");
});
