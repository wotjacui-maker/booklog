// Open Library edition metadata: https://openlibrary.org/dev/docs/api/search
(() => {
  const cache = new Map();
  async function searchBooks(query, signal) {
    const key = query.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const params = new URLSearchParams({
      q: query + (/[가-힣]/.test(query) ? ' language:kor' : ''),
      lang: 'ko', limit: '6',
      fields: 'key,title,author_name,editions,editions.key,editions.title,editions.publisher',
    });
    const response = await fetch('https://openlibrary.org/search.json?' + params, { signal });
    if (!response.ok) throw new Error('Search unavailable');
    const data = await response.json();
    const results = (data.docs || []).flatMap(work =>
      (work.editions?.docs || []).map(edition => ({
        title: edition.title || work.title || '',
        author: (work.author_name || []).join(', '),
        publisher: [...new Set(edition.publisher || [])].join(', '),
      }))
    ).filter(book => book.title);
    cache.set(key, results);
    return results;
  }

  function attach(prefix, modalId) {
    const title = document.getElementById(prefix + 'Title');
    const author = document.getElementById(prefix + 'Author');
    const publisher = document.getElementById(prefix + 'Publisher');
    const modal = document.getElementById(modalId);
    const panel = document.createElement('div');
    panel.className = 'title-suggestions';
    panel.hidden = true;
    const status = document.createElement('div');
    status.className = 'title-search-status';
    status.setAttribute('role', 'status');
    status.id = prefix + 'SearchStatus';
    const options = document.createElement('div');
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', '검색된 책');
    const source = document.createElement('a');
    source.href = 'https://openlibrary.org';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Open Library';
    source.className = 'title-search-source';
    panel.append(status, options, source);
    title.after(panel);
    title.setAttribute('aria-describedby', status.id);
    title.placeholder = '책 제목을 입력하면 찾아드려요';
    let timer, controller, revision = 0, composing = false;
    function cancel() {
      clearTimeout(timer);
      controller?.abort();
      revision++;
    }
    function close() {
      cancel();
      panel.hidden = true;
      options.replaceChildren();
    }
    function queue() {
      cancel();
      options.replaceChildren();
      const query = title.value.trim();
      if (composing || query.length < 2) { panel.hidden = true; return; }
      panel.hidden = false;
      status.textContent = '책을 찾는 중…';
      const request = revision;
      timer = setTimeout(async () => {
        const current = new AbortController();
        controller = current;
        const timeout = setTimeout(() => current.abort(), 10000);
        try {
          const results = await searchBooks(query, current.signal);
          if (request !== revision) return;
          status.textContent = results.length
            ? '책을 선택하면 저자와 출판사가 채워져요.'
            : '검색 결과가 없어요. 제목을 더 입력하거나 직접 작성해주세요.';
          results.forEach(book => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'title-suggestion';
            const name = document.createElement('span');
            name.textContent = book.title;
            const meta = document.createElement('small');
            meta.textContent = `${book.author || '저자 정보 없음'} · ${book.publisher || '출판사 정보 없음'}`;
            button.append(name, meta);
            button.addEventListener('click', () => {
              title.value = book.title;
              // 검색 정보가 비어 있으면 사용자가 입력한 값은 유지한다.
              if (book.author) author.value = book.author;
              if (book.publisher) publisher.value = book.publisher;
              close();
              publisher.focus();
            });
            options.appendChild(button);
          });
        } catch {
          if (request === revision) status.textContent = '지금은 검색에 연결할 수 없어요. 직접 입력하거나 잠시 후 다시 입력해주세요.';
        } finally { clearTimeout(timeout); }
      }, 650);
    }
    title.addEventListener('compositionstart', () => { composing = true; close(); });
    title.addEventListener('compositionend', () => { composing = false; queue(); });
    title.addEventListener('input', queue);
    title.addEventListener('keydown', e => {
      if (e.isComposing) return;
      if (e.key === 'ArrowDown' && options.firstChild) {
        e.preventDefault(); options.firstChild.focus();
      }
      if (e.key === 'Escape') close();
    });
    panel.addEventListener('keydown', e => {
      if (e.key === 'Escape') { close(); title.focus(); }
      const buttons = [...options.children];
      const index = buttons.indexOf(document.activeElement);
      if (index >= 0 && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
      }
    });
    title.form.addEventListener('reset', close);
    new MutationObserver(() => { if (modal.classList.contains('hidden')) close(); })
      .observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
  attach('input', 'addModal');
  attach('edit', 'editModal');
})();
