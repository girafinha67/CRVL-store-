(function(){
  "use strict";

  // Ano no footer
  var yearEl = document.getElementById('year');
  if(yearEl){ yearEl.textContent = new Date().getFullYear(); }

  // Header on scroll
  var header = document.getElementById('header');
  var backToTop = document.getElementById('backToTop');
  function onScroll(){
    var y = window.scrollY || window.pageYOffset;
    if(header){ header.classList.toggle('scrolled', y > 40); }
    if(backToTop){ backToTop.classList.toggle('visible', y > 600); }
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  // Mobile menu toggle
  var menuToggle = document.getElementById('menuToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  if(menuToggle && mobileMenu){
    menuToggle.addEventListener('click', function(){
      var isOpen = mobileMenu.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    mobileMenu.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click', function(){
        mobileMenu.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Scroll reveal
  var revealEls = document.querySelectorAll('.reveal-scroll');
  if('IntersectionObserver' in window && revealEls.length){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold:0.15, rootMargin:'0px 0px -60px 0px' });
    revealEls.forEach(function(el){ io.observe(el); });

    // Rede de segurança: em previews/ferramentas que renderizam a página
    // inteira sem disparar um scroll real (ex.: alguns apps de "visualização"
    // ao trocar a resolução para tablet/laptop), o IntersectionObserver nunca
    // dispara e o conteúdo fica com opacity:0 para sempre, criando um vão
    // vazio na página. Forçamos a revelação de tudo após um pequeno atraso.
    setTimeout(function(){
      revealEls.forEach(function(el){
        el.classList.add('in-view');
      });
      io.disconnect();
    }, 1200);
  } else {
    revealEls.forEach(function(el){ el.classList.add('in-view'); });
  }

  // Formulário "Fale com a gente" — abre o WhatsApp com a mensagem pronta
  var quickMsgForm = document.getElementById('quickMsgForm');
  if(quickMsgForm){
    quickMsgForm.addEventListener('submit', function(e){
      e.preventDefault();
      var input = document.getElementById('quickMsgInput');
      var value = (input && input.value || '').trim();
      if(!value){ return; }
      var base = 'Olá! Vim pelo site da CRVL Store e queria saber sobre: ';
      var url = 'https://wa.me/5511982291198?text=' + encodeURIComponent(base + value);
      window.open(url, '_blank', 'noopener');
      if(input){ input.value = ''; }
    });
  }

  // Vídeo de fundo do hero — respeita prefers-reduced-motion
  var heroVideo = document.querySelector('.hero-video');
  if(heroVideo){
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduceMotion){
      heroVideo.removeAttribute('autoplay');
      heroVideo.pause();
    }
  }

  // Arrastar com o mouse nas fileiras horizontais (ex.: "Escolha seu modelo")
  // O scroll por toque/trackpad já funciona nativamente; isso cobre o mouse.
  function makeDraggable(el){
    if(!el) return;
    var isDown = false;
    var startX = 0;
    var startScroll = 0;
    var moved = 0;

    el.addEventListener('mousedown', function(e){
      isDown = true;
      moved = 0;
      el.classList.add('dragging');
      startX = e.pageX;
      startScroll = el.scrollLeft;
    });

    window.addEventListener('mouseup', function(){
      if(!isDown) return;
      isDown = false;
      el.classList.remove('dragging');
    });

    window.addEventListener('mousemove', function(e){
      if(!isDown) return;
      e.preventDefault();
      var dx = e.pageX - startX;
      moved = Math.max(moved, Math.abs(dx));
      el.scrollLeft = startScroll - dx;
    });

    // Se o mouse arrastou de verdade, cancela o clique do link logo em seguida
    // (evita abrir a página errada sem querer ao soltar depois de arrastar).
    el.addEventListener('click', function(e){
      if(moved > 6){
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }
  makeDraggable(document.querySelector('.model-row'));

  // Widget "Sobre Nós" — quadradinho de vídeo no canto inferior esquerdo
  var sobreWidget = document.getElementById('sobreWidget');
  var sobreWidgetOpen = document.getElementById('sobreWidgetOpen');
  var sobreWidgetClose = document.getElementById('sobreWidgetClose');
  var sobreModal = document.getElementById('sobreModal');
  var sobreModalClose = document.getElementById('sobreModalClose');
  var sobreModalVideo = document.getElementById('sobreModalVideo');
  var sobreModalMute = document.getElementById('sobreModalMute');

  function openSobreModal(){
    if(!sobreModal) return;
    sobreModal.classList.add('open');
    sobreModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if(sobreModalVideo){
      sobreModalVideo.currentTime = 0;
      sobreModalVideo.muted = false;
      if(sobreModalMute){ sobreModalMute.classList.remove('is-muted'); }
      sobreModalVideo.play().catch(function(){
        // Autoplay com som pode ser bloqueado pelo navegador — cai para mudo
        sobreModalVideo.muted = true;
        if(sobreModalMute){ sobreModalMute.classList.add('is-muted'); }
        sobreModalVideo.play().catch(function(){});
      });
    }
  }

  function closeSobreModal(){
    if(!sobreModal) return;
    sobreModal.classList.remove('open');
    sobreModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if(sobreModalVideo){ sobreModalVideo.pause(); }
  }

  if(sobreWidgetOpen){ sobreWidgetOpen.addEventListener('click', openSobreModal); }
  if(sobreModalClose){ sobreModalClose.addEventListener('click', closeSobreModal); }
  if(sobreModal){
    sobreModal.addEventListener('click', function(e){
      if(e.target === sobreModal){ closeSobreModal(); }
    });
  }
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ closeSobreModal(); }
  });
  if(sobreModalMute && sobreModalVideo){
    sobreModalMute.addEventListener('click', function(){
      sobreModalVideo.muted = !sobreModalVideo.muted;
      sobreModalMute.classList.toggle('is-muted', sobreModalVideo.muted);
    });
  }
  if(sobreWidgetClose && sobreWidget){
    sobreWidgetClose.addEventListener('click', function(e){
      e.stopPropagation();
      sobreWidget.classList.add('hidden');
    });
  }

})();
