// Logique de Lightbox et actualisation dynamique des galeries pour le portfolio

document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = document.querySelector('.lightbox-close');
  const prevBtn = document.querySelector('.lightbox-prev');
  const nextBtn = document.querySelector('.lightbox-next');

  let currentImages = [];
  let currentIndex = 0;

  // Fonction pour initialiser les onglets et cartes
  function initGalleries() {
    ['photos', 'films'].forEach(sectionId => {
      const container = document.getElementById(sectionId);
      if (!container) return;
      
      const projectCards = container.querySelectorAll('.project-card');
      const detailsContainers = container.querySelectorAll('.project-details-item');

      projectCards.forEach(card => {
        card.addEventListener('click', () => {
          // Enlever la classe active des cartes de cette section
          projectCards.forEach(c => c.classList.remove('active'));
          card.classList.add('active');

          // Cacher les conteneurs de cette section
          detailsContainers.forEach(g => {
            g.style.display = 'none';
            g.classList.remove('active');
          });

          // Afficher le bon conteneur
          const targetId = card.getAttribute('data-target');
          const targetContainer = document.getElementById(targetId);
          if (targetContainer) {
            targetContainer.style.display = 'block';
            targetContainer.classList.add('active');
            if (targetContainer.classList.contains('masonry-gallery')) {
              bindLightboxToGallery(targetContainer);
            }
            // Défiler doucement jusqu'à la galerie (uniquement sur mobile)
            if (window.innerWidth <= 768) {
              setTimeout(() => {
                const headerOffset = 100;
                const elementPosition = targetContainer.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.scrollY - headerOffset;
                window.scrollTo({
                  top: offsetPosition,
                  behavior: "smooth"
                });
              }, 50); // Petit délai pour laisser le temps au navigateur de rendre l'affichage
            }
          }
        });
      });

      // Initialiser la première active
      const defaultGallery = container.querySelector('.project-details-item.active');
      if (defaultGallery && defaultGallery.classList.contains('masonry-gallery')) {
        bindLightboxToGallery(defaultGallery);
      }
    });

    // Cas spécifique: Sous-galeries (Courts-métrages)
    const stillsGalleries = document.querySelectorAll('.stills-gallery');
    stillsGalleries.forEach(gallery => {
      bindLightboxToGallery(gallery);
    });
  }

  // Chargement automatique des photos depuis les dossiers
  async function loadDynamicGalleries() {
    let data = null;
    try {
      // 1. Essayer d'abord l'API en direct du serveur local
      const res = await fetch('/api/galleries', { cache: 'no-store' });
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      // 2. Si l'API échoue (hébergement statique), se replier sur le fichier galleries.json
      try {
        const resFallback = await fetch('./galleries.json', { cache: 'no-store' });
        if (resFallback.ok) {
          data = await resFallback.json();
        }
      } catch (e) {}
    }

    if (!data) return;

    // Normalisation des clés pour faire correspondre data-folder
    const normalizedData = {};
    for (const [key, list] of Object.entries(data)) {
      normalizedData[key.toLowerCase().trim()] = list;
    }

    // Mettre à jour chaque conteneur doté d'un attribut data-folder
    const containers = document.querySelectorAll('[data-folder]');
    containers.forEach(container => {
      const folderKey = (container.getAttribute('data-folder') || '').toLowerCase().trim();
      const images = normalizedData[folderKey];
      if (!images || !Array.isArray(images) || images.length === 0) return;

      // Si c'est une galerie masonry (Photos)
      if (container.classList.contains('masonry-gallery')) {
        container.innerHTML = '';
        images.forEach(imgPath => {
          const item = document.createElement('div');
          item.className = 'gallery-item';
          const img = document.createElement('img');
          img.src = imgPath;
          img.alt = container.id.replace('gallery-', '');
          img.loading = 'lazy';
          item.appendChild(img);
          container.appendChild(item);
        });
        bindLightboxToGallery(container);
      } 
      // Si c'est une galerie stills (Photogrammes courts-métrages)
      else if (container.classList.contains('stills-gallery')) {
        container.innerHTML = '';
        images.forEach((imgPath, idx) => {
          const img = document.createElement('img');
          img.src = imgPath;
          img.alt = `${container.getAttribute('data-gallery') || 'Film'} Still ${idx + 1}`;
          img.loading = 'lazy';
          container.appendChild(img);
        });
        bindLightboxToGallery(container);
      }
    });
  }

  // Fonction helper pour attacher la lightbox aux images d'une galerie
  function bindLightboxToGallery(galleryContainer) {
    const images = Array.from(galleryContainer.querySelectorAll('img'));
    images.forEach((img, index) => {
      img.onclick = () => openLightbox(images, index);
    });
  }

  // Ouvrir la lightbox
  function openLightbox(imagesGroup, index) {
    currentImages = imagesGroup;
    currentIndex = index;
    updateLightboxImage();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Empêcher le scroll
  }

  // Fermer la lightbox
  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (!lightbox.classList.contains('active')) {
        lightboxImg.src = '';
      }
    }, 300);
  }

  // Mettre à jour l'image affichée dans la lightbox
  function updateLightboxImage() {
    const src = currentImages[currentIndex].src;
    lightboxImg.style.opacity = 0; // fade out
    setTimeout(() => {
      lightboxImg.src = src;
      lightboxImg.style.opacity = 1; // fade in
    }, 150);
  }

  // Navigation suivante
  function showNext() {
    if (currentImages.length === 0) return;
    currentIndex = (currentIndex + 1) % currentImages.length;
    updateLightboxImage();
  }

  // Navigation précédente
  function showPrev() {
    if (currentImages.length === 0) return;
    currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
    updateLightboxImage();
  }

  // Événements UI de la lightbox
  closeBtn.addEventListener('click', closeLightbox);
  nextBtn.addEventListener('click', showNext);
  prevBtn.addEventListener('click', showPrev);

  // Fermer si clic en dehors de l'image
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target === document.querySelector('.lightbox-content')) {
      closeLightbox();
    }
  });

  // Clavier (Flèches et Echap)
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  });

  // Support Swipe (Mobile)
  let touchStartX = 0;
  let touchEndX = 0;

  lightbox.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  lightbox.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) {
      showNext();
    }
    if (touchEndX > touchStartX + swipeThreshold) {
      showPrev();
    }
  }

  // Initialisation au chargement de la page
  initGalleries();
  loadDynamicGalleries();
});
