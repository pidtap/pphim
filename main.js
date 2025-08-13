// main.js

// --- 1. BIẾN TOÀN CỤC CHO TRANG CHỦ ---
let currentPage = 1;
let currentView = { type: 'homepage' };
let slideInterval;
let featuredMovies = [];
let nguoncClientMovies = [];
let nguoncCurrentPage = 1;
const nguoncItemsPerPage = 14;

const homeCategories = [
    { title: 'Phim Lẻ Mới', slug: 'phim-le' },
    { title: 'Phim Bộ Mới', slug: 'phim-bo' },
    { title: 'Phim Hoạt Hình', slug: 'hoat-hinh' },
    { title: 'TV Shows', slug: 'tv-shows' }
];

// --- 2. HÀM DÀNH RIÊNG CHO TRANG CHỦ ---

/** Lấy dữ liệu cho các danh mục trên trang chủ */
async function fetchCategoryData(slug) {
    const config = getCurrentApiConfig();
    const currentSourceId = config.id;
    const path = config.paths.homeCategory(slug);

    if (currentSourceId === 'nguonc') {
        try {
            const [data1, data2] = await Promise.all([
                fetch(`${config.base}${config.paths.homeCategory(slug, 1)}`).then(res => res.json()),
                fetch(`${config.base}${config.paths.homeCategory(slug, 2)}`).then(res => res.json())
            ]);
            let items1 = config.dataAccess.items(data1) || [];
            let items2 = config.dataAccess.items(data2) || [];
            
            // Áp dụng transform nếu có
            if (config.dataAccess.transform) {
                items1 = items1.map(movie => config.dataAccess.transform(movie));
                items2 = items2.map(movie => config.dataAccess.transform(movie));
            }
            return [...items1, ...items2];
        } catch (err) {
            console.error(`Lỗi tải 2 trang cho danh mục ${slug}:`, err);
            return [];
        }
    } else {
        try {
            const res = await fetch(`${config.base}${path}`);
            const data = await res.json();
            let movies = config.dataAccess.items(data) || [];
            
            // Áp dụng transform nếu có
            if (config.dataAccess.transform) {
                movies = movies.map(movie => config.dataAccess.transform(movie));
            }
            return movies;
        } catch (err) {
            console.error(`Lỗi tải danh mục ${slug}:`, err);
            return [];
        }
    }
}

/** Hiển thị slider phim nổi bật */
async function initializeHomepageSlider() {
    const sliderContainer = document.querySelector('.hero-slider-container');
    if (!sliderContainer) return;

    const config = getCurrentApiConfig();
    try {
        const response = await fetch(`${config.base}${config.paths.sliderList(30)}`);
        const data = await response.json();
        let allMovies = config.dataAccess.items(data);

        if (!allMovies || allMovies.length === 0) {
            sliderContainer.style.display = 'none';
            return;
        }

        // Áp dụng transform nếu có
        if (config.dataAccess.transform) {
            allMovies = allMovies.map(movie => config.dataAccess.transform(movie));
        }

        const shuffledMovies = [...allMovies].sort(() => 0.5 - Math.random());
        featuredMovies = (await Promise.all(
            shuffledMovies.slice(0, 5).map(movie => getMovieDetails(movie.slug))
        )).filter(Boolean);

        if (featuredMovies.length === 0) {
            sliderContainer.style.display = 'none';
            return;
        }

        sliderContainer.innerHTML = '';
        featuredMovies.forEach(movie => {
            const slide = document.createElement('div');
            slide.className = 'hero-slide';
            let imageUrl = movie.poster_url || movie.thumb_url;
            if (imageUrl && !imageUrl.startsWith('http')) imageUrl = config.img_base + imageUrl;
            
            slide.style.backgroundImage = `url(${imageUrl})`;
            slide.innerHTML = `
                <div class="slide-content">
                    <div class="slide-text-wrapper">
                        <h2>${movie.name}</h2>
                        <div class="meta">
                            <span>Năm: ${movie.year || 'N/A'}</span> • 
                            <span>Quốc gia: ${movie.country?.map(c => c.name).join(', ') || 'N/A'}</span>
                        </div>
                        <p class="description">${(movie.content || 'Chưa có mô tả.').replace(/<[^>]*>?/gm, '')}</p>
                        <div class="slide-actions">
                            <button class="watch-btn" onclick="startWatching('${movie.slug}')"><i class="fas fa-play"></i> Xem phim</button>
                        </div>
                    </div>
                </div>`;
            sliderContainer.appendChild(slide);
        });

        sliderContainer.style.display = 'block';
        showSlide(0);
        startSlideInterval();
    } catch (error) {
        console.error("Lỗi tải slider:", error);
        sliderContainer.style.display = 'none';
    }
}

let currentSlideIndex = 0;
function showSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    currentSlideIndex = (index + slides.length) % slides.length;
    slides.forEach(s => s.classList.remove('active'));
    slides[currentSlideIndex].classList.add('active');
}
function nextSlide() { showSlide(currentSlideIndex + 1); }
function startSlideInterval() {
    clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, 5000);
}


/** Hiển thị nội dung trang chủ */
async function renderHomepage() {
    const sliderContainer = document.querySelector('.hero-slider-container');
    const pageContent = document.getElementById("page-content");
    const paginationEl = document.getElementById("pagination");

    document.body.classList.add('is-homepage');
    if (sliderContainer) sliderContainer.classList.remove('hidden');
    pageContent.innerHTML = ''; 
    if(paginationEl) paginationEl.classList.add('hidden');
    currentView = { type: 'homepage' };

    let allSectionsHtml = `
        <section id="history-section" class="category-section" style="display: none;">
            <div class="category-header">
                <h2 class="category-title">Lịch sử xem phim</h2>
            </div>
            <div class="movie-carousel"></div>
            <button class="carousel-nav-btn prev"><i class="fas fa-chevron-left"></i></button>
            <button class="carousel-nav-btn next"><i class="fas fa-chevron-right"></i></button>
        </section>`;
    
    homeCategories.forEach(category => {
        allSectionsHtml += `
            <section class="category-section" data-slug="${category.slug}">
                <div class="category-header">
                    <h2 class="category-title">${category.title}</h2>
                    <a href="#" class="see-more-link" onclick="event.preventDefault(); showCategoryPage('${category.slug}', '${category.title}')">Xem thêm <i class="fas fa-chevron-right"></i></a>
                </div>
                <div class="movie-carousel"><div class="skeleton-carousel">${'<div class="skeleton skeleton-card"></div>'.repeat(7)}</div></div>
                <button class="carousel-nav-btn prev"><i class="fas fa-chevron-left"></i></button>
                <button class="carousel-nav-btn next"><i class="fas fa-chevron-right"></i></button>
            </section>`;
    });

    allSectionsHtml += `
        <section id="favorites-section" class="category-section" style="display: none;">
            <div class="category-header">
                <h2 class="category-title">Phim Yêu Thích</h2>
                <a href="favorites.html" class="see-more-link">Xem thêm <i class="fas fa-chevron-right"></i></a>
            </div>
            <div class="movie-carousel"></div>
            <button class="carousel-nav-btn prev"><i class="fas fa-chevron-left"></i></button>
            <button class="carousel-nav-btn next"><i class="fas fa-chevron-right"></i></button>
        </section>`;

    pageContent.innerHTML = allSectionsHtml;

    renderHistorySection();
    renderFavoritesSection();

    for (const category of homeCategories) {
        const movies = await fetchCategoryData(category.slug);
        const section = pageContent.querySelector(`.category-section[data-slug="${category.slug}"]`);
        if (section && movies && movies.length > 0) {
            const carousel = section.querySelector('.movie-carousel');
            carousel.innerHTML = '';
            movies.forEach(movie => carousel.appendChild(createMovieCard(movie)));
            attachCarouselEventsForSection(section); // Kích hoạt lại hàm gắn sự kiện cho nút bấm
        } else if (section) {
            section.style.display = 'none';
        }
    }
    
    initializeAutoScrollCarousels();
}
function renderHistorySection() {
    const historySection = document.getElementById('history-section');
    if (!historySection) return;
    const historyData = JSON.parse(localStorage.getItem('watchHistoryList') || '[]');
    if (historyData.length > 0) {
        historySection.style.display = 'block';
        const historyCarousel = historySection.querySelector('.movie-carousel');
        historyCarousel.innerHTML = '';
        historyData.forEach(movie => historyCarousel.appendChild(createMovieCard(movie, true)));
        attachCarouselEventsForSection(historySection);
    } else {
        historySection.style.display = 'none';
    }
}

function renderFavoritesSection() {
    const favoritesSection = document.getElementById('favorites-section');
    if (!favoritesSection) return;
    const favoritesData = JSON.parse(localStorage.getItem('favoriteMovies') || '[]');
    if (favoritesData.length > 0) {
        favoritesSection.style.display = 'block';
        const favoritesCarousel = favoritesSection.querySelector('.movie-carousel');
        favoritesCarousel.innerHTML = '';
        favoritesData.forEach(movie => favoritesCarousel.appendChild(createMovieCard(movie)));
        attachCarouselEventsForSection(favoritesSection);
    } else {
        favoritesSection.style.display = 'none';
    }
}


/** Hiển thị trang danh sách phim (danh mục, tìm kiếm) */
async function fetchAndShowPaginatedResults(url, title, page) {
    const pageContent = document.getElementById("page-content");
    const paginationEl = document.getElementById("pagination");
    window.scrollTo({ top: 0, behavior: 'smooth' });

    pageContent.innerHTML = `<div class="skeleton-grid">${'<div class="skeleton skeleton-card"></div>'.repeat(14)}</div>`;

    const config = getCurrentApiConfig();
    try {
        const res = await fetch(url);
        const data = await res.json();
        let movies = config.dataAccess.items(data) || [];
        const pagination = config.dataAccess.pagination(data);

        // Áp dụng transform nếu có
        if (config.dataAccess.transform) {
            movies = movies.map(movie => config.dataAccess.transform(movie));
        }

        pageContent.innerHTML = `<h2 id="section-title">${title}</h2>`;
        if (movies.length > 0) {
            const gridContainer = document.createElement('div');
            gridContainer.className = 'movie-grid';
            movies.forEach(movie => gridContainer.appendChild(createMovieCard(movie)));
            pageContent.appendChild(gridContainer);
            
            let totalPages = pagination?.totalPages;
            if (!totalPages && pagination?.totalItems) {
                totalPages = Math.ceil(pagination.totalItems / 14);
            }
            if(config.id === 'nguonc') totalPages = undefined;
            
            paginationEl.classList.remove('hidden');
            renderPagination(page, totalPages);
        } else {
            pageContent.innerHTML += `<p style="text-align: center; margin-top: 20px;">Không tìm thấy kết quả nào.</p>`;
            paginationEl.classList.add('hidden');
        }
    } catch (err) {
        pageContent.innerHTML = "Lỗi khi tải phim.";
        paginationEl.classList.add('hidden');
        console.error(err);
    }
}
/** Hiển thị trang thể loại */
function showCategoryPage(slug, title, page = 1) {
    document.body.classList.remove('is-homepage');
    document.querySelector('.hero-slider-container')?.classList.add('hidden');
    currentView = { type: 'category', slug, title };
    currentPage = page;
    const config = getCurrentApiConfig();
    const url = `${config.base}${config.paths.category(slug, page)}`;
    fetchAndShowPaginatedResults(url, title, page);
}

/** Hiển thị trang lịch sử */
function showHistoryPage() {
    document.body.classList.remove('is-homepage');
    document.querySelector('.hero-slider-container')?.classList.add('hidden');
    const pageContent = document.getElementById("page-content");
    const paginationEl = document.getElementById("pagination");
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    pageContent.innerHTML = `<h2 id="section-title">Lịch sử xem phim</h2>`;
    paginationEl.classList.add('hidden');
    
    const historyData = JSON.parse(localStorage.getItem('watchHistoryList') || '[]');
    if (historyData.length > 0) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'movie-grid';
        historyData.forEach(movie => gridContainer.appendChild(createMovieCard(movie, true)));
        pageContent.appendChild(gridContainer);
    } else {
        pageContent.innerHTML += '<p style="text-align: center; margin-top: 20px;">Lịch sử xem phim của bạn trống.</p>';
    }
    currentView = { type: 'history' };
}

/** Xử lý tìm kiếm */
function handleSearch(query, page = 1) {
    if (!query) return;
    document.body.classList.remove('is-homepage');
    document.querySelector('.hero-slider-container')?.classList.add('hidden');
    currentView = { type: 'search', query };
    currentPage = page;
    const config = getCurrentApiConfig();
    const url = `${config.base}${config.paths.search(query, page)}`;
    fetchAndShowPaginatedResults(url, `🔍 Kết quả cho: "${query}"`, page);
}

/** Phân trang */
function renderPagination(currentPage, totalPages) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer || !totalPages || totalPages <= 1) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    let pageItems = [];
    const maxPagesToShow = 5;
    const halfPages = Math.floor(maxPagesToShow / 2);

    pageItems.push(`<button class="page-btn" onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`);
    
    if (totalPages <= maxPagesToShow + 2) {
        for (let i = 1; i <= totalPages; i++) pageItems.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`);
    } else {
        let startPage = Math.max(2, currentPage - halfPages);
        let endPage = Math.min(totalPages - 1, currentPage + halfPages);

        if (currentPage - 1 <= halfPages) endPage = maxPagesToShow - 1;
        if (totalPages - currentPage <= halfPages) startPage = totalPages - maxPagesToShow + 2;

        pageItems.push(`<button class="page-btn ${1 === currentPage ? 'active' : ''}" onclick="goToPage(1)">1</button>`);
        if (startPage > 2) pageItems.push(`<span class="page-ellipsis">...</span>`);
        for (let i = startPage; i <= endPage; i++) pageItems.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`);
        if (endPage < totalPages - 1) pageItems.push(`<span class="page-ellipsis">...</span>`);
        pageItems.push(`<button class="page-btn ${totalPages === currentPage ? 'active' : ''}" onclick="goToPage(${totalPages})">${totalPages}</button>`);
    }

    pageItems.push(`<button class="page-btn" onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`);
    paginationContainer.innerHTML = pageItems.join('');
}

function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage < 1) return;
    goToPage(newPage);
}

function goToPage(page) {
    if (currentView.type === 'category') {
        showCategoryPage(currentView.slug, currentView.title, page);
    } else if (currentView.type === 'search') {
        handleSearch(currentView.query, page);
    }
}

/** Gắn sự kiện cho carousel */
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
/**
 * Chuẩn bị các carousel để tự động trượt (Hiệu ứng băng chuyền)
 */
function initializeAutoScrollCarousels() {
    
}
// --- 3. KHỞI CHẠY ---
document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo các UI dùng chung và truyền vào hàm xử lý tìm kiếm của trang chủ
    initializeSharedUI(handleSearch);
    
    const urlParams = new URLSearchParams(window.location.search);
    const searchQueryFromUrl = urlParams.get('search_query');

    if (searchQueryFromUrl) {
        document.getElementById('search-input').value = decodeURIComponent(searchQueryFromUrl);
        handleSearch(decodeURIComponent(searchQueryFromUrl));
    } else {
        initializeHomepageSlider();
        renderHomepage();
    }
    
    document.getElementById('logo-link').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'index.html';
    });
});
