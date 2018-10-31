(function () {
  var form = document.querySelector('form#search')
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    const pageId = form.querySelector('[name=id]').value
    const path = '/edit/' + pageId
    form.setAttribute('action', path)
    form.submit()
  })
}())