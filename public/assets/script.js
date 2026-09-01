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

  // Vídeo de fundo do hero — respeita prefers-reduced-motion
  var heroVideo = document.querySelector('.hero-video');
  if(heroVideo){
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduceMotion){
      heroVideo.removeAttribute('autoplay');
      heroVideo.pause();
    }
  }

})();
