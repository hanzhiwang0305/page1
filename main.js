/* ============================================================================
   Wang Hanzhi · 动态交互与设计创作 — 交互脚本
   ----------------------------------------------------------------------------
   零依赖，全部原生实现：
     1  预加载器      进度分段 + clip 揭示 + 幕布上滑
     2  平滑滚动      Lenis 风格 lerp（滚轮拦截 + 锚点 easeOutExpo）
     3  滚动进度驱动  --p / --pin / --sy 三个 CSS 变量驱动全部滚动动效
     4  入场与脉冲    IntersectionObserver（阈值 .45 / 1.8s 脉冲）
     5  手风琴        Web Animations 测高动画 600ms，同组互斥
     6  弹窗          原生 <dialog> + clip-path 揭幕 + is-lock 锁滚动
     7  移动菜单      全屏面板 + 条目 stagger
     8  Cookie        本地标记，不追踪
     9  表单          电话掩码 + 逐字段校验
   降级：prefers-reduced-motion 与 pointer:coarse 下自动关闭平滑滚动与动效
   ========================================================================== */
(function(){
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  var fine = !coarse && !reduce;

  /* =========================================================
     1. 预加载器（复刻：进度分段 + Logo clip 揭示 + 橙色幕布上滑）
     ========================================================= */
  (function preloader(){
    var root = document.querySelector("[data-preloader]");
    if(!root) return;
    var curtain = root.querySelector("[data-preloader-curtain]");
    var logo = root.querySelector("[data-preloader-logo]");
    var progress = root.querySelector("[data-preloader-progress]");
    var mark = 700, tail = 250, timeout = 1500;
    var ready = false, readyAt = 0, start = performance.now();

    if("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0,0);

    var finish = function(){
      window.scrollTo(0,0);
      if(progress) progress.textContent = "100%";
      setTimeout(function(){
        if(logo) logo.animate([{opacity:1},{opacity:0}],{duration:reduce?1:180,easing:"ease",fill:"forwards"});
        setTimeout(function(){
          var anims = [];
          if(curtain) anims.push(curtain.animate(
            [{transform:"translateY(0)"},{transform:"translateY(-100%)"}],
            {duration:reduce?1:450,easing:"cubic-bezier(0.76, 0, 0.24, 1)",fill:"forwards"}));
          if(progress) anims.push(progress.animate(
            [{opacity:1,transform:"translateY(0)"},{opacity:0,transform:"translateY(-24px)"}],
            {duration:reduce?1:300,easing:"ease",fill:"forwards"}));
          Promise.all(anims.map(function(a){return a.finished.catch(function(){});}))
            .then(function(){ root.classList.add("is-complete"); showCookie(); });
        }, 60);
      }, reduce?0:60);
    };

    var tick = function(now){
      var t = now - start;
      var v = Math.min(90, t / mark * 90);
      if(ready && t >= mark){
        var base = Math.max(start + mark, readyAt);
        v = 90 + Math.min(10, (now - base) / tail * 10);
      }
      if(progress) progress.textContent = Math.round(v) + "%";
      if(logo) logo.style.clipPath = "inset(" + (100 - v) + "% 0 0 0)";
      if(v >= 100){ finish(); return; }
      requestAnimationFrame(tick);
    };

    if(reduce || coarse){
      root.classList.add("is-complete"); showCookie(); return;
    }
    var markReady = function(){ if(ready) return; ready = true; readyAt = performance.now(); };
    Promise.race([
      (document.fonts && document.fonts.ready) || Promise.resolve(),
      new Promise(function(res){ window.setTimeout(res, timeout); })
    ]).then(markReady);
    requestAnimationFrame(tick);
  })();

  function showCookie(){
    var banner = document.querySelector("[data-cookie-banner]");
    if(!banner) return;
    try{ if(localStorage.getItem("wh-cookie-consent")) return; }catch(e){}
    banner.hidden = false;
  }

  /* =========================================================
     2. 平滑滚动（Lenis 风格：滚轮 lerp + 锚点缓动）
     ========================================================= */
  var target = window.scrollY, current = window.scrollY, rafId = null, animating = false;

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function maxScroll(){ return document.documentElement.scrollHeight - window.innerHeight; }

  function frame(){
    current += (target - current) * 0.12;
    if(Math.abs(target - current) < 0.4){ current = target; window.scrollTo(0, current); animating = false; rafId = null; return; }
    window.scrollTo(0, current);
    rafId = requestAnimationFrame(frame);
  }
  function start(){
    if(rafId === null){ animating = true; rafId = requestAnimationFrame(frame); }
  }
  function scrollTo(y, immediate){
    target = clamp(y, 0, maxScroll());
    if(immediate || !fine){ current = target; window.scrollTo(0, target); return; }
    start();
  }

  window.addEventListener("wheel", function(e){
    if(!fine) return;
    if(e.target.closest && e.target.closest("[data-lenis-prevent]")) return;
    if(document.documentElement.classList.contains("is-lock")) return;
    e.preventDefault();
    target = clamp(target + (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY), 0, maxScroll());
    start();
  }, {passive:false});

  window.addEventListener("scroll", function(){
    if(!animating){ target = window.scrollY; current = window.scrollY; }
  }, {passive:true});

  /* 锚点导航：按距离决定时长（600–1400ms），ease-out */
  function easeOutExpo(t){ return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function anchorTo(hash){
    var el = hash === "#top" ? document.body : document.querySelector(hash);
    if(!el) return;
    var y = hash === "#top" ? 0 : el.getBoundingClientRect().top + window.scrollY - 60;
    y = clamp(y, 0, maxScroll());
    if(!fine){ window.scrollTo({top:y, behavior:"auto"}); target = y; current = y; return; }
    var from = window.scrollY, dist = y - from;
    var dur = clamp(Math.abs(dist) * 0.55, 600, 1400);
    var t0 = performance.now();
    (function step(now){
      var p = clamp((now - t0) / dur, 0, 1);
      var v = from + dist * easeOutExpo(p);
      window.scrollTo(0, v); current = v; target = y;
      if(p < 1) requestAnimationFrame(step);
      else { animating = false; }
    })(t0);
  }
  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest("a[data-nav]");
    if(!a) return;
    var href = a.getAttribute("href") || "";
    if(href.charAt(0) !== "#") return;
    e.preventDefault();
    closeMenu();
    anchorTo(href);
  });

  /* =========================================================
     3. 滚动进度驱动（--p / --pin / --sy）
     ========================================================= */
  var progressEls = Array.prototype.slice.call(document.querySelectorAll("[data-progress]"));
  var pinEls = Array.prototype.slice.call(document.querySelectorAll("[data-pin]"));
  var hero = document.querySelector(".hero");
  var wordmark = document.querySelector("[data-footer-wordmark]");
  var wordmarkFill = document.querySelector("[data-footer-wordmark-fill]");
  var skillsBars = Array.prototype.slice.call(document.querySelectorAll(".skills__progress i"));
  var skillsSlides = Array.prototype.slice.call(document.querySelectorAll(".skills__slide"));
  var header = document.querySelector("[data-header]");
  var footer = document.querySelector("[data-footer]");
  var themeSections = Array.prototype.slice.call(document.querySelectorAll("[data-header-theme]"));
  var theme = "";

  function onScrollFrame(){
    var vh = window.innerHeight;
    var y = window.scrollY;

    if(hero) hero.style.setProperty("--sy", y.toFixed(1));

    progressEls.forEach(function(el){
      var r = el.getBoundingClientRect();
      var p = clamp((vh - r.top) / (vh * 0.9), 0, 1);
      el.style.setProperty("--p", p.toFixed(3));
    });

    pinEls.forEach(function(el){
      var r = el.getBoundingClientRect();
      var total = el.offsetHeight - vh;
      var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
      el.style.setProperty("--pin", p.toFixed(3));
      if(skillsSlides.length === 3){
        var seg = p * 3;
        skillsSlides.forEach(function(slide, i){
          if(i === 0) return;
          var local = clamp(seg - i + 1, 0, 1);
          slide.style.clipPath = "inset(0 0 " + ((1 - local) * 100).toFixed(2) + "% 0)";
        });
        var active = clamp(Math.floor(seg + 0.0001), 0, 2);
        skillsBars.forEach(function(bar, i){
          bar.style.setProperty("--v", (i === active ? clamp(seg - i, 0, 1) : (i < active ? 1 : 0)).toFixed(3));
        });
      }
    });

    /* 页脚大字标：随滚动"墨迹上涌" */
    if(wordmark && wordmarkFill && footer){
      var fr = footer.getBoundingClientRect();
      var absTop = fr.top + y;               // 页脚绝对顶部
      var startY = Math.max(0, absTop - vh); // 页脚刚进入视口时的滚动量
      var span = Math.max(260, maxScroll() - startY);
      var fp = clamp((y - startY) / span, 0, 1);
      wordmark.style.height = (fp * (window.innerWidth < 768 ? 110 : 200)).toFixed(1) + "px";
    }

    /* 头部换肤 */
    if(header){
      var probe = y + 40, next = "light";
      themeSections.forEach(function(sec){
        var top = sec.offsetTop, h = sec.offsetHeight;
        if(probe >= top && probe < top + h) next = sec.getAttribute("data-header-theme");
      });
      if(next !== theme){
        theme = next;
        header.classList.remove("header--light","header--dark","header--none");
        header.classList.add("header--" + next);
      }
    }
  }

  var scrollQueued = false;
  function requestScroll(){
    if(scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function(){ scrollQueued = false; onScrollFrame(); });
  }
  window.addEventListener("scroll", requestScroll, {passive:true});
  window.addEventListener("resize", requestScroll);
  onScrollFrame();

  /* =========================================================
     4. 入场揭示 + 数据脉冲（IntersectionObserver）
     ========================================================= */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if("IntersectionObserver" in window){
    var ro = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add("is-in"); ro.unobserve(en.target); }
      });
    }, {rootMargin:"0px 0px -12% 0px", threshold:0.15});
    revealEls.forEach(function(el){ ro.observe(el); });

    var pulseMap = new WeakMap();
    var mo = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        var el = en.target, t = pulseMap.get(el);
        if(t){ clearTimeout(t); pulseMap.delete(el); }
        if(!en.isIntersecting){ el.classList.remove("is-metric-visible"); return; }
        el.classList.add("is-metric-visible");
        pulseMap.set(el, setTimeout(function(){
          el.classList.remove("is-metric-visible"); pulseMap.delete(el);
        }, 1800));
      });
    }, {threshold:0.45});
    document.querySelectorAll("[data-benefit-card]").forEach(function(el){ mo.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add("is-in"); });
  }

  /* =========================================================
     5. 手风琴（600ms 测高动画 + 同组互斥）
     ========================================================= */
  var DUR = reduce ? 1 : 600, EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  document.querySelectorAll("[data-accordion]").forEach(function(item){
    var summary = item.querySelector("[data-accordion-summary]");
    var content = item.querySelector("[data-accordion-content]");
    if(!summary || !content) return;
    var anim = null;

    var settle = function(open){
      item.open = open; item.style.height = ""; item.style.overflow = "";
      if(anim){ anim.cancel(); anim = null; }
    };
    var close = function(){
      if(!item.open && !anim) return;
      var h = item.getBoundingClientRect().height;
      var target = summary.offsetHeight + item.offsetHeight - item.clientHeight;
      if(anim) anim.cancel();
      item.dataset.expanded = "false";
      item.style.height = h + "px"; item.style.overflow = "hidden";
      anim = item.animate([{height:h+"px"},{height:target+"px"}],{duration:DUR,easing:EASE,fill:"forwards"});
      var a = anim;
      a.onfinish = function(){ if(anim === a) settle(false); };
    };
    var open = function(){
      var h = item.getBoundingClientRect().height;
      if(anim) anim.cancel();
      item.dataset.expanded = "true"; item.open = true;
      var target = item.getBoundingClientRect().height;
      item.style.height = h + "px"; item.style.overflow = "hidden";
      anim = item.animate([{height:h+"px"},{height:target+"px"}],{duration:DUR,easing:EASE,fill:"forwards"});
      var a = anim;
      a.onfinish = function(){ if(anim === a) settle(true); };
    };
    item.addEventListener("accordion:close", close);
    summary.addEventListener("click", function(e){
      e.preventDefault();
      if(item.open){ close(); return; }
      var list = item.closest("[data-accordion-list]");
      if(list) list.querySelectorAll("[data-accordion]").forEach(function(other){
        if(other !== item && other.open) other.dispatchEvent(new CustomEvent("accordion:close"));
      });
      open();
    });
  });

  /* =========================================================
     6. 弹窗（原生 dialog + clip-path 揭幕 + 锁滚动）
     ========================================================= */
  document.addEventListener("click", function(e){
    var el = e.target;
    if(!(el instanceof Element)) return;
    var opener = el.closest("[data-modal-open]");
    if(opener){
      var dlg = document.getElementById(opener.getAttribute("data-modal-open"));
      if(dlg){
        e.preventDefault();
        closeMenu();
        if(typeof dlg.showModal === "function") dlg.showModal();
        document.documentElement.classList.add("is-lock");
      }
      return;
    }
    if(el.closest("[data-modal-close]")){ el.closest("dialog").close(); return; }
    if(el instanceof HTMLDialogElement){
      var r = el.getBoundingClientRect();
      if(e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) el.close();
    }
  });
  document.querySelectorAll("dialog").forEach(function(d){
    d.addEventListener("close", function(){
      if(!document.querySelector("dialog[open]")) document.documentElement.classList.remove("is-lock");
    });
  });

  /* =========================================================
     7. 移动菜单
     ========================================================= */
  var menu = document.querySelector("[data-menu]");
  var menuToggle = document.querySelector("[data-menu-toggle]");
  var menuLabel = document.querySelector("[data-menu-label]");
  function closeMenu(){
    if(!menu || !menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    if(menuToggle) menuToggle.setAttribute("aria-expanded","false");
    if(menuLabel) menuLabel.textContent = "Menu";
    document.documentElement.classList.remove("is-lock");
  }
  if(menuToggle){
    menuToggle.addEventListener("click", function(){
      var open = !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", open);
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
      if(menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
      document.documentElement.classList.toggle("is-lock", open);
    });
  }

  /* =========================================================
     8. Cookie
     ========================================================= */
  var cookieBtn = document.querySelector("[data-cookie-accept]");
  if(cookieBtn){
    cookieBtn.addEventListener("click", function(){
      var banner = document.querySelector("[data-cookie-banner]");
      try{ localStorage.setItem("wh-cookie-consent","accepted"); }catch(e){}
      if(banner) banner.hidden = true;
    });
  }

  /* =========================================================
     9. 表单：电话掩码 + 校验
     ========================================================= */
  function maskPhone(value){
    var digits = value.replace(/\D/g,"").slice(0,11);
    if(!digits) return "";
    var out = "+86";
    if(digits.length) out += " " + digits.slice(0,3);
    if(digits.length > 3) out += " " + digits.slice(3,7);
    if(digits.length > 7) out += " " + digits.slice(7,11);
    return out;
  }
  document.querySelectorAll("[data-phone]").forEach(function(input){
    input.addEventListener("input", function(){
      var pos = input.selectionStart;
      var before = input.value;
      input.value = maskPhone(input.value);
      if(pos && before.length && input.value.length !== before.length){
        var d = input.value.length - before.length;
        input.setSelectionRange(pos + d, pos + d);
      }
    });
  });

  var LABELS = {name:"请填写你的名字", email:"请填写有效邮箱", phone:"请填写联系电话", consent:"请先同意隐私政策"};
  document.querySelectorAll("[data-form]").forEach(function(form){
    var status = form.querySelector("[data-form-status]");
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var ok = true, firstBad = null;
      form.querySelectorAll(".field__error").forEach(function(p){ p.textContent = ""; });

      var check = function(name, valid, msg){
        var err = form.querySelector('[data-error-for="' + name + '"]');
        if(!valid){
          ok = false;
          if(err) err.textContent = msg;
          if(!firstBad) firstBad = form.querySelector('[name="' + name + '"]');
        }
      };
      var nameEl = form.querySelector('[name="name"]');
      var emailEl = form.querySelector('[name="email"]');
      var phoneEl = form.querySelector('[name="phone"]');
      var consentEl = form.querySelector('[name="consent"]');

      if(nameEl) check("name", nameEl.value.trim().length > 0, LABELS.name);
      if(emailEl) check("email", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailEl.value.trim()), LABELS.email);
      if(phoneEl && phoneEl.hasAttribute("required")) check("phone", phoneEl.value.replace(/\D/g,"").length >= 11, LABELS.phone);
      if(consentEl && !consentEl.checked){
        ok = false;
        if(status) status.textContent = LABELS.consent;
      }

      if(!ok){
        if(status && !status.textContent) status.textContent = "请检查标红的字段";
        if(firstBad) firstBad.focus();
        return;
      }
      if(status) status.textContent = "已收到，我会在 24 小时内回复你。";
      form.querySelectorAll(".field__control").forEach(function(i){ i.value = ""; });
      if(consentEl) consentEl.checked = false;
    });
  });

  /* 视口跨断点时重建布局（复刻原站的 reload 策略） */
  var mqReload = window.matchMedia("(min-width: 1024px)");
  if(mqReload.addEventListener){
    mqReload.addEventListener("change", function(){
      clearTimeout(window.__rel);
      window.__rel = setTimeout(function(){ onScrollFrame(); }, 200);
    });
  }
})();
