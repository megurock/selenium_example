(function () {
  var form = document.querySelector('form#edit')
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    const pageId = document.getElementById('id').textContent
    const path = '/done/' + pageId
    form.setAttribute('action', path)
    form.submit()
  })
}())