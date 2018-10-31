const express = require('express')
const app = express()
const auth = require('basic-auth-connect')
const bodyParser = require('body-parser')
const fs = require('fs-extra')
let stub

app.set('port', 3000)
app.set('view engine', 'pug')
app.use(auth('foo', 'bar'))
app.use(express.static('static'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true,
}))

// トップページ
app.get('/', function (req, res) {
  res.render('index', {
    title: 'ログイン',
  })
})

// ログイン後ページ
app.post('/', function (req, res) {
  const USER_NAME = 'guest'
  const PASSWORD = 'xyz'
  const isLoginSuccess = (req.body.username === USER_NAME && req.body.password === PASSWORD)
  const title = isLoginSuccess ? 'Welcome' : 'Login Error'
  const message = isLoginSuccess ? `こんにちは、${req.body.username} さん！` : 'ログインエラー'
  res.render('login', {
    title,
    message,
    isLoginSuccess,
  })
})

// 検索ページ
app.get('/search', function (req, res) {
  res.render('search', {
    title: '検索画面',
  })
})

// 編集ページ
app.post('/edit/:id', function (req, res) {
  stub = JSON.parse(fs.readFileSync('./stub.json', 'utf-8'))
  const id = req.params.id || ''
  const model = stub[id]
  res.render('edit', {
    title: `編集画面 - ${id}`,
    id,
    model,
  })
})

// 編集完了ページ
app.post('/done/:id', function (req, res) {
  const id = req.params.id || ''
  const model = {
    name: req.body.name,
    sex: req.body.sex,
    language: req.body.language,
    level: req.body.level,
  }
  stub[id] = model
  fs.outputFileSync('stub.json', JSON.stringify(stub))
  res.render('done', {
    title: `編集完了画面 - ${id}`,
    id,
    model,
  })
})

app.listen(app.get('port'), function () {
  console.log(`Listening on port ${app.get('port')}...`);
})