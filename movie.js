// movie.js - PHIÊN BẢN CÓ PHIM YÊU THÍCH

// --- BIẾN TOÀN CỤC ---
let currentMovieData = null;

// --- HÀM XỬ LÝ GIAO DIỆN ---

/**
 * Hiển thị toàn bộ trang chi tiết phim
 */
function renderFullMoviePage(details) {
    currentMovieData = details;
    renderHybridHero(details);
}

/**
 * Hiển thị Hero Section
 */
function renderHybridHero(details) {
    const heroSection = document.getElementById('movie-hero-section');
    const config = getCurrentApiConfig();

    const backgroundUrl = details.backdrop_url || details.poster_url;
    if (backgroundUrl) {
        const finalBgUrl = backgroundUrl.startsWith('http') ? backgroundUrl : config.img_base + backgroundUrl;
        heroSection.style.backgroundImage = `url('${finalBgUrl}')`;
    }

    const posterUrl = details.poster_url || details.thumb_url;
    const finalPosterUrl = posterUrl
        ? (posterUrl.startsWith('http') ? posterUrl : config.img_base + posterUrl)
        : 'https://placehold.co/300x450/1a1a1a/555?text=No+Image';

    const favorites = JSON.parse(localStorage.getItem('favoriteMovies') || '[]');
    const isFavorited = favorites.some(movie => movie.slug === details.slug);

    const originName = details.origin_name || 'Đang cập nhật';
    const language = details.lang || details.language || 'Đang cập nhật';
    const actorsText = details.actor && details.actor.length > 0 ? details.actor.join(', ') : 'Đang cập nhật';

    heroSection.innerHTML = `
        <div class="hero-overlay"></div>
        <div class="hero-content">
            <div class="details-poster">
                <img src="${finalPosterUrl}" alt="Poster of ${details.name}">
            </div>
            <div class="details-info">
                <h1>${details.name}</h1>
                <div class="movie-detail-meta">
                    <span>${details.year || 'N/A'}</span>
                    <span>${details.episode_current || 'N/A'}</span>
                    <span>${details.country?.[0]?.name || 'N/A'}</span>
                </div>
                <div class="movie-additional-info">
                    <p><strong>Tên gốc:</strong> ${originName}</p>
                    <p><strong>Ngôn ngữ:</strong> ${language}</p>
                    <p><strong>Diễn viên:</strong> ${actorsText}</p>
                    <p class="movie-detail-description"><strong>Mô tả:</strong>${(details.content || 'Chưa có mô tả.').replace(/<[^>]*>?/gm, '')}</p>
                </div>
                
                <div class="movie-detail-actions">
                    <a href="watch.html?slug=${details.slug}" class="action-btn watch-now-btn">
                        <i class="fas fa-play"></i> Xem Phim
                    </a>
                    <button class="action-btn favorite-btn ${isFavorited ? 'active' : ''}" onclick="toggleFavorite('${details.slug}', this)">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Hiển thị mục Phim Yêu Thích
 */
function renderFavoritesSection() {
    const favoritesSection = document.getElementById('favorites-section');
    if (!favoritesSection) return;
    const favoritesData = JSON.parse(localStorage.getItem('favoriteMovies') || '[]');
    if (favoritesData.length > 0) {
        favoritesSection.style.display = 'block';
        const favoritesCarousel = favoritesSection.querySelector('.movie-carousel');
        favoritesCarousel.innerHTML = '';
        favoritesData.slice(0, 10).forEach(movie => favoritesCarousel.appendChild(createMovieCard(movie)));
        attachCarouselEventsForSection(favoritesSection);
    } else {
        favoritesSection.style.display = 'none';
    }
}


/**
 * Gắn sự kiện cho carousel
 */
function attachCarouselEventsForSection(section) {
    const carousel = section.querySelector('.movie-carousel');
    const prevBtn = section.querySelector('.carousel-nav-btn.prev');
    const nextBtn = section.querySelector('.carousel-nav-btn.next');
    if (!carousel || !prevBtn || !nextBtn) return;

    const updateNavButtons = () => {
        prevBtn.disabled = carousel.scrollLeft < 2;
        nextBtn.disabled = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 2;
    };
    prevBtn.addEventListener('click', () => carousel.scrollBy({ left: -carousel.clientWidth, behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' }));
    carousel.addEventListener('scroll', updateNavButtons, { passive: true });
    new ResizeObserver(updateNavButtons).observe(carousel);
    updateNavButtons();
}


// --- HÀM KHỞI CHẠY CHÍNH ---
document.addEventListener('DOMContentLoaded', async () => {
    initializeSharedUI((query) => {
        if (query) window.location.href = `index.html?search_query=${encodeURIComponent(query)}`;
    });

    const urlParams = new URLSearchParams(window.location.search);
    const movieSlug = urlParams.get('slug');

    if (movieSlug) {
        const details = await getMovieDetails(movieSlug);
        if (details) {
            document.title = `${details.name} - P Movie`;
            renderFullMoviePage(details);
            renderFavoritesSection(); // Gọi hàm hiển thị phim yêu thích
        } else {
             document.getElementById('movie-hero-section').innerHTML = '<p style="text-align:center; padding: 50px;">Không thể tải thông tin phim.</p>';
        }
    } else {
        document.getElementById('movie-hero-section').innerHTML = '<p style-align:center; padding: 50px;">Không tìm thấy phim.</p>';
    }
});