import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSiteName, splitUrl } from '@shared/url-parts'

test('splitUrl separa domínio e caminho', () => {
  assert.deepEqual(
    splitUrl('https://www.electronjs.org/docs/latest/api/web-contents-view'),
    {
      domain: 'electronjs.org',
      path: '/docs/latest/api/web-contents-view'
    }
  )
  assert.deepEqual(splitUrl('https://news.ycombinator.com/'), {
    domain: 'news.ycombinator.com',
    path: ''
  })
  assert.deepEqual(splitUrl('https://a.com/x?y=1#z'), {
    domain: 'a.com',
    path: '/x?y=1#z'
  })
  assert.deepEqual(splitUrl(''), { domain: '', path: '' })
})

test('nome do site: segundo nível composto e IP', () => {
  assert.equal(getSiteName('https://developer.mozilla.org/en-US'), 'mozilla')
  assert.equal(getSiteName('https://en.wikipedia.org/wiki/X'), 'wikipedia')
  assert.equal(getSiteName('https://www.bbc.co.uk/'), 'bbc')
  assert.equal(getSiteName('http://127.0.0.1:3000/'), '127.0.0.1')
})
