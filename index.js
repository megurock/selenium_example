const xlsx = require('xlsx')
const { Builder, By, Key, until } = require('selenium-webdriver')
const config = require('./config.js')
const fs = require('fs-extra')
const path = require('path')
const moment = require('moment')
// CSVのヘッダ設定
const ws = xlsx.utils.json_to_sheet([], { 
  header: ['ID', '名前[前]', '性別[前]', '言語[前]', '熟練度[前]', '名前[後]', '性別[後]', '言語[後]', '熟練度[後]'] 
})
// ログファイルの出力設定。プログラム実行時の日時ベースの名前とする
const pathToOutputResults = `results/${moment().format('YYYYMMDD_HHmmss')}.csv`
let driver
let countDone = 0

/**
 * Excel を読込み、パース結果を JSON 配列として返却
 */
function getPages(pathToExcel) {
  const workbook = xlsx.readFile(pathToExcel)
  return xlsx.utils.sheet_to_json(
    workbook.Sheets['pages']                  // 対象シートを指定
  ).filter(page => page.target !== undefined) // 対象データを抽出
}


/**
 * Chromeドライバを生成
 */
async function createDriver(option = { width: 480, height: 720 }) {
  return new Promise(async resolve => {
    // Chromeドライバを起動
    const driver = await new Builder().forBrowser('chrome').build()
    // ウィンドウサイズを指定してブラウザを開く
    await driver.manage().window().setRect(option)
    resolve(driver)
  })
}

/**
 * 編集画面へ移動
 */
async function goToEditPage(page) {
  return new Promise(async (resolve, reject) => {
    let isSuccess = true

    await driver.navigate().to('http://localhost:3000/search')

    // 検索フィールドが表示されるまで待機します
    const by = By.css('input[name=id]')
    await driver
      .wait(
        until.elementLocated(by),
        3 * 1000,
        '検索フィールドが見つかりませんでした。'
      ).catch(error => {
        isSuccess = false
        reject(error)
      })

    // 検索フィールドにページIDを入力し[RETURN]キーを押下げ
    await driver.findElement(by).sendKeys(page.id, Key.RETURN)

    // 編集フォームが表示されるまで待機します
    await driver
      .wait(
        until.elementLocated(By.css('form#edit')),
        3 * 1000,
        '該当のページが見つかりませんでした。'
      ).catch(error => {
        isSuccess = false
        reject(error)
      })

    resolve(isSuccess)
  })
}

/**
 * 選択されている要素の値を取得
 */
async function getSelectedValue(elements, isMultiple = false) {
  return new Promise(async (resove, reject) => {
    let selectedValues = []
    for (let i = 0, len = elements.length; i < len; i++) {
      const element = elements[i]
      if (await element.isSelected()) {
        selectedValues.push(await element.getAttribute('value'))
        if (!isMultiple) {
          break
        }
      }
    }
    resove(isMultiple ? selectedValues : selectedValues.shift())
  })
}

/**
 * チェックボックスの選択解除
 */
async function deselectCheckbox(checkboxes) {
  return new Promise(async (resolve, reject) => {
    checkboxes.forEach(async checkbox => {
      if (await checkbox.isSelected()) {
        await checkbox.click()
      }
    })
    resolve()
  })
}

/**
 * 要素を選択する
 */
async function selectElements(elements, values) {
  return new Promise(async (resolve, reject) => {
    values = [].concat(values)
    for (let i = 0, len = values.length; i < len; i++) {
      const value = values[i]
      for (let j = 0, len2 = elements.length; j < len2; j++) {
        const element = elements[j]
        const elementVal = await element.getAttribute('value')
        if (value.trim() === elementVal.trim()) {
          await element.click()
          break
        }
      }
    }
    resolve()
  })
}

/**
 * ページ編集処理
 */
async function edit(page) {
  return new Promise(async (resolve, reject) => {
    // フォーム要素を取得
    const form = await driver.findElement(By.id('edit'))
    const nameTextInput = await form.findElement(By.css('input[name=name]'))
    const sexRadios = await form.findElements(By.css('input[name=sex]'))
    const langCheckboxes = await form.findElements(By.css('input[name=language]'))
    const levelOptions = await form.findElements(By.css('select[name=level] option'))

    // 編集前の状態を取得
    const beforeEdit = {
      name: await nameTextInput.getAttribute('value'),
      sex: await getSelectedValue(sexRadios),
      language: await getSelectedValue(langCheckboxes, true),
      level: await getSelectedValue(levelOptions),
    }

    // 「名前」を編集
    await nameTextInput.clear() // 先にテキストを空にしておく
    await nameTextInput.sendKeys(page.name) // テキスト入力

    // 「性別」を編集
    await selectElements(sexRadios, page.sex)

    // 「言語」を編集
    await deselectCheckbox(langCheckboxes) // すべてのチェックボックスを選択解除
    await selectElements(langCheckboxes, page.language.split(','))

    // 「熟練度」を編集
    await selectElements(levelOptions, page.level)

    // 編集後の状態を取得
    const afterEdit = {
      name: await nameTextInput.getAttribute('value'),
      sex: await getSelectedValue(sexRadios),
      language: await getSelectedValue(langCheckboxes, true),
      level: await getSelectedValue(levelOptions),
    }

    // 保存ボタンをクリック
    await form.findElement(By.css('button#save')).click()

    // 「編集完了」ページへの遷移を待機
    await driver
      .wait(async () => {
        const title = await driver.getTitle()
        return title.indexOf('編集完了画面') !== -1
      }, )
    //
    resolve({
      before: beforeEdit,
      after: afterEdit
    })
  })
}

/**
 * ログを出力する
 */
function writeResults(result) {
  xlsx.utils.sheet_add_json(ws, [result], { skipHeader: true, origin: -1 })
  const csv = xlsx.utils.sheet_to_csv(ws)
  fs.outputFileSync(pathToOutputResults , csv)
}

/**
 * すべてのページの編集が終わるまでループ
 */
async function loopEdit(pages) {
  return new Promise(async resolve => {
    const totalPages = pages.length
    if (countDone < totalPages) {
      console.log(`${countDone + 1}ページ目の編集を開始します。`)
      const page = pages[countDone]
      await goToEditPage(page)
      const { before, after } = await edit(page)
      // プロパティの順番はワークシートに合わせる
      writeResults({
        id: page.id,
        nameBefore: before.name,
        sexBefore: before.sex,
        langBefore: before.language.join(','),
        levelBefore: before.level,
        nameAfter: after.name,
        sexAfter: after.sex,
        langAfter: after.language.join(','),
        levelAfter: after.level,
      })
      // 編集作業が完了したら完了カウントを加算
      countDone++
    }
    // 全ページの編集が完了したらPromiseを解決
    if (countDone === totalPages) {
      console.log('全ページの編集が完了しました。')
    // まだ作業が完了していないページがあれば再帰呼び出し
    } else {
      await loopEdit(pages)
    }
    resolve()
  })
}

/**
 * ログイン処理
 */
async function login() {
  return new Promise(async (resolve) => {
    // http://foo:bar@localhost:3000
    const url = config.loginUrl.replace(/(https?:\/\/)(.+)/, `$1${config.basicAuthId}:${config.basicAuthPassword}@$2`)
    // 基本認証のIDとパスワードを設定しつつ管理画面へアクセス
    await driver.get(url)
    // ログインIDを入力
    await driver
      .findElement(By.css('input[name=username]'))
      .sendKeys(config.loginId)
    // ログインパスワードを入力し、[RETURN]キー押下げ（ログイン実行）
    await driver
      .findElement(By.css('input[name=password]'))
      .sendKeys(config.loginPassword, Key.RETURN)

    // ログイン成功メッセージが表示されるまで最大3秒待ちます。
    await driver
      .wait(async () => {
        const message = await driver.findElement(By.id('message')).getText()
        return message.indexOf('こんにちは') === 0
      })

    resolve()
  })
}

/**
 * 初期実行関数
 */
(async function init() {
  const pages = getPages('./list.xlsx')
  driver = await createDriver()
  await login()
  await loopEdit(pages)
  await driver.quit() // ドライバを停止
})()