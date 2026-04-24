function _getFilePreviewContext() {
  if (window.location.protocol !== 'file:') return null;

  var path = window.location.pathname;
  var segments = path.split('/').filter(Boolean);
  var fileName = segments[segments.length - 1] || '';
  var folderName = segments[segments.length - 2] || '';
  var routedFolders = ['kurzy', 'o-mne', 'reference', 'blog', 'kontakt', 'gdpr'];
  var isRoutedSubpage = fileName === 'index.html' && routedFolders.indexOf(folderName) !== -1;

  return {
    prefix: isRoutedSubpage ? '../' : '',
    sitePath: isRoutedSubpage ? '/' + folderName : (fileName === 'index.html' ? '/' : '/' + fileName.replace(/\.html$/, ''))
  };
}

function _rewriteRootRelativeSrcset(srcset, prefix) {
  return srcset.split(',').map(function (candidate) {
    var part = candidate.trim();
    if (!part) return part;

    var tokens = part.split(/\s+/);
    if (tokens[0].charAt(0) === '/') {
      tokens[0] = prefix + tokens[0].replace(/^\/+/, '');
    }

    return tokens.join(' ');
  }).join(', ');
}

function _toLocalPreviewHref(siteHref, prefix) {
  if (!siteHref || siteHref.charAt(0) !== '/') return siteHref;

  var hash = '';
  var hashIndex = siteHref.indexOf('#');
  if (hashIndex !== -1) {
    hash = siteHref.slice(hashIndex);
    siteHref = siteHref.slice(0, hashIndex);
  }

  if (siteHref === '/') {
    return prefix + 'index.html' + hash;
  }

  var cleanPath = siteHref.replace(/^\/+/, '').replace(/\/+$/, '');
  return prefix + cleanPath + '/index.html' + hash;
}

function applyFilePreviewCompatibility() {
  var context = _getFilePreviewContext();
  if (!context) return;

  document.querySelectorAll('img[src^="/"]').forEach(function (img) {
    var src = img.getAttribute('src');
    img.setAttribute('src', context.prefix + src.replace(/^\/+/, ''));
  });

  document.querySelectorAll('source[srcset]').forEach(function (source) {
    var srcset = source.getAttribute('srcset') || '';
    if (srcset.indexOf('/') === -1) return;
    source.setAttribute('srcset', _rewriteRootRelativeSrcset(srcset, context.prefix));
  });

  document.querySelectorAll('a[href^="/"]').forEach(function (link) {
    var href = link.getAttribute('href');
    link.dataset.sitePath = href;
    link.setAttribute('href', _toLocalPreviewHref(href, context.prefix));
  });
}

applyFilePreviewCompatibility();

// ── Active nav highlight ─────────────────────────────────────
(function () {
  var previewContext = _getFilePreviewContext();
  var path = previewContext ? previewContext.sitePath : (window.location.pathname.replace(/\/+$/, '') || '/');

  document.querySelectorAll('.nav-links a').forEach(function (a) {
    var href = a.dataset.sitePath || a.getAttribute('href') || '';
    href = href.split('#')[0].replace(/\/+$/, '') || '/';
    if (href === path) a.classList.add('active');
  });
})();

// ── Mobile menu ──────────────────────────────────────────────
function toggleMobileMenu() {
  var menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

// ── Animations ───────────────────────────────────────────────
function initFadeIn() {
  var els = document.querySelectorAll('.fade-in');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e, i) {
      if (e.isIntersecting) {
        setTimeout(function () { e.target.classList.add('visible'); }, i * 80);
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(function (el) { observer.observe(el); });
}

function initDrawings() {
  var els = document.querySelectorAll('.u, .u2, .enc');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        setTimeout(function () { e.target.classList.add('drawn'); }, 200);
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.8 });
  els.forEach(function (el) {
    if (!el.classList.contains('drawn')) observer.observe(el);
  });
}

// ── Courses ───────────────────────────────────────────────────
function openCourse(id) {
  document.querySelectorAll('.course-detail').forEach(function (d) { d.classList.remove('open'); });
  var el = document.getElementById('detail-' + id);
  if (el) {
    el.classList.add('open');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeDetail() {
  document.querySelectorAll('.course-detail').forEach(function (d) { d.classList.remove('open'); });
}

// ── Blog ─────────────────────────────────────────────────────
var blogPage = 0;
var blogTotalPages = 1;
var blogTotalPosts = 0;
var blogLoading = false;

function _stripHtml(html) {
  var d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || d.innerText || '').trim();
}

function _formatDate(iso) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function _blogCardHtml(post) {
  var id = post.id;
  var title = post.title.rendered;
  var excerpt = _stripHtml(post.excerpt.rendered);
  var imgHtml = '<div class="blog-img">\uD83D\uDCDD</div>';
  if (post.featured_image_url) {
    imgHtml = '<div class="blog-img" style="background:none;padding:0"><img src="' + post.featured_image_url + '" alt=""></div>';
  }
  return '<div class="blog-card" onclick="showBlogPost(' + Number(id) + ')" style="cursor:pointer">' +
    imgHtml +
    '<div class="blog-body"><h3>' + title + '</h3><p>' + excerpt.slice(0, 140) + (excerpt.length > 140 ? '\u2026' : '') + '</p></div>' +
    '</div>';
}

async function showBlogPost(postId) {
  var listView = document.getElementById('blog-list-view');
  var detailView = document.getElementById('blog-detail-view');
  if (!listView || !detailView) return;

  listView.style.display = 'none';
  detailView.style.display = 'block';
  detailView.innerHTML = '<div class="blog-loading"><p>Načítám příspěvek\u2026</p></div>';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  var ctrl = new AbortController();
  var tid = setTimeout(function () { ctrl.abort(); }, 10000);
  try {
    var res = await fetch(
      'https://blog.porodnikurzy.cz/wp-json/wp/v2/posts/' + Number(postId) + '?_fields=id,title,content,date,featured_image_url',
      { mode: 'cors', signal: ctrl.signal }
    );
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var post = await res.json();

    var title = post.title.rendered;
    var content = post.content.rendered;
    var heroImg = '';
    if (post.featured_image_url) {
      heroImg = '<img class="blog-detail-hero" src="' + post.featured_image_url + '" alt="">';
    }

    detailView.innerHTML =
      '<div class="blog-detail-header"><div class="container">' +
      '<button onclick="hideBlogPost()" style="background:rgba(157,30,57,0.1);border:none;color:var(--rose);padding:0.4rem 1.2rem;border-radius:2rem;cursor:pointer;font-size:0.82rem;margin-bottom:1.5rem;font-family:\'DM Sans\',sans-serif">\u2190 Zpět na blog</button>' +
      '<h1>' + title + '</h1>' +
      '</div></div>' +
      '<div class="blog-detail-body">' +
      (heroImg ? '<div class="blog-detail-body-img">' + heroImg + '</div>' : '') +
      '<div class="blog-detail-content">' + content + '</div>' +
      '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:2.5rem;padding-top:2rem;border-top:1px solid rgba(157,30,57,0.12)">' +
      '<button onclick="hideBlogPost()" class="btn btn-outline">\u2190 Zpět na blog</button>' +
      '<a href="/kontakt" class="btn btn-primary">Mám víc dotazů</a>' +
      '</div>' +
      '</div>';
  } catch (e) {
    clearTimeout(tid);
    detailView.innerHTML =
      '<div class="blog-loading"><p>Příspěvek se nepodařilo načíst.</p>' +
      '<button onclick="hideBlogPost()" class="btn btn-outline" style="margin-top:1.5rem">\u2190 Zpět na blog</button></div>';
    console.error('Chyba při načítání příspěvku:', e);
  }
}

function hideBlogPost() {
  var listView = document.getElementById('blog-list-view');
  var detailView = document.getElementById('blog-detail-view');
  if (listView) listView.style.display = '';
  if (detailView) detailView.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadBlogPosts() {
  if (blogLoading || blogPage > 0) return;
  blogLoading = true;
  var grid = document.getElementById('blog-cards-grid');
  var spinner = document.getElementById('blog-spinner');
  if (!grid) { blogLoading = false; return; }

  var ctrl = new AbortController();
  var tid = setTimeout(function () { ctrl.abort(); }, 10000);
  try {
    var res = await fetch(
      'https://blog.porodnikurzy.cz/wp-json/wp/v2/posts?per_page=6&page=1&_fields=id,title,excerpt,date,featured_image_url',
      { mode: 'cors', signal: ctrl.signal }
    );
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) throw new Error('no posts');

    blogTotalPosts = parseInt(res.headers.get('X-WP-Total') || '0', 10);
    blogTotalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
    blogPage = 1;

    grid.innerHTML = posts.map(_blogCardHtml).join('');
    if (spinner) spinner.style.display = 'none';
    grid.style.display = '';
    _updateBlogPagination();
    setTimeout(initFadeIn, 50);
  } catch (e) {
    clearTimeout(tid);
    if (spinner) spinner.style.display = 'none';
    var fallback = document.getElementById('blog-fallback');
    if (fallback) fallback.style.display = '';
    console.info('Blog API nedostupné:', e.message);
  } finally {
    blogLoading = false;
  }
}

async function loadMoreBlogPosts() {
  if (blogLoading || blogPage >= blogTotalPages) return;
  blogLoading = true;
  var btn = document.getElementById('blog-load-more');
  if (btn) btn.disabled = true;
  var nextPage = blogPage + 1;
  var ctrl = new AbortController();
  var tid = setTimeout(function () { ctrl.abort(); }, 10000);
  try {
    var res = await fetch(
      'https://blog.porodnikurzy.cz/wp-json/wp/v2/posts?per_page=6&page=' + nextPage + '&_fields=id,title,excerpt,date,featured_image_url',
      { mode: 'cors', signal: ctrl.signal }
    );
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) throw new Error('no posts');
    var grid = document.getElementById('blog-cards-grid');
    if (grid) grid.insertAdjacentHTML('beforeend', posts.map(_blogCardHtml).join(''));
    blogPage = nextPage;
    _updateBlogPagination();
    setTimeout(initFadeIn, 50);
  } catch (e) {
    clearTimeout(tid);
    console.info('Blog API chyba:', e.message);
  } finally {
    blogLoading = false;
    if (btn) btn.disabled = false;
  }
}

function _updateBlogPagination() {
  var pagination = document.getElementById('blog-pagination');
  var count = document.getElementById('blog-count');
  var btn = document.getElementById('blog-load-more');
  if (!pagination) return;
  var loaded = document.querySelectorAll('#blog-cards-grid .blog-card').length;
  var hasMore = blogPage < blogTotalPages;
  pagination.style.display = (blogTotalPosts > 2 && hasMore) ? '' : 'none';
  if (count) count.textContent = 'Zobrazeno ' + loaded + ' z ' + blogTotalPosts + ' článků';
  if (btn) btn.style.display = hasMore ? '' : 'none';
}

// ── FAQ accordion ────────────────────────────────────────────
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.spk-faq__q');
    if (!btn) return;
    var isOpen = btn.getAttribute('aria-expanded') === 'true';
    var answer = btn.nextElementSibling;
    document.querySelectorAll('.spk-faq__q').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      b.nextElementSibling.classList.remove('is-open');
    });
    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      answer.classList.add('is-open');
    }
  });
})();

// ── Contact form ─────────────────────────────────────────────
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;
  var submitBtn = form.querySelector('button[type="submit"]');
  var msgEl = document.getElementById('form-message');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var formData = new FormData(form);
    var originalText = submitBtn.textContent;
    submitBtn.textContent = 'Odesílám\u2026';
    submitBtn.disabled = true;
    msgEl.style.display = 'none';

    try {
      var response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });
      var data = await response.json();
      if (response.ok) {
        msgEl.textContent = 'Zpráva odeslána! Ozvu se vám do 48 hodin.';
        msgEl.style.background = '#f0fdf4';
        msgEl.style.color = '#166534';
        msgEl.style.border = '1px solid #bbf7d0';
        msgEl.style.display = 'block';
        form.reset();
      } else {
        throw new Error(data.message || 'Chyba serveru');
      }
    } catch (err) {
      msgEl.textContent = 'Nepodařilo se odeslat zprávu. Zkuste to prosím znovu nebo mi napište přímo na email.';
      msgEl.style.background = '#fff1f2';
      msgEl.style.color = '#9f1239';
      msgEl.style.border = '1px solid #fecdd3';
      msgEl.style.display = 'block';
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
})();

// ── Init on load ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function () {
  setTimeout(initFadeIn, 200);
  setTimeout(initDrawings, 350);

  // Baby carousel — duplicate images for seamless infinite scroll
  var carousel = document.getElementById('babyCarousel');
  if (carousel) {
    var clone = carousel.innerHTML;
    carousel.innerHTML += clone;
  }

  // Blog: auto-load posts if on blog page
  if (document.getElementById('blog-cards-grid')) {
    loadBlogPosts();
  }

  // Kurzy: open course from URL hash (e.g. /kurzy#individual)
  if (window.location.hash && document.getElementById('coursesGrid')) {
    var id = window.location.hash.replace('#', '');
    openCourse(id);
  }
});
