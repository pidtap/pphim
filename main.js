let currentPage = 1;
let currentView = { type: 'homepage' };
const movieDetailsCache = {};

const API_SOURCES = {
    ophim: {
        id: 'ophim',
        name: 'Nguồn 1 (Ophim)',
        base: "https://ophim1.com",
        img_base: "https://img.ophim.live/uploads/movies/",
        paths: {
            details: (slug) => `/phim/${slug}`,
            category: (slug, page) => `/v1/api/danh-sach/${slug}?page=${page}&limit=30`,
            search: (keyword, page) => `/v1/api/tim-kiem?keyword=${keyword}&page=${page}&limit=30`,
            homeCategory: (slug) => `/v1/api/danh-sach/${slug}?limit=20&page=1`
        },
        dataAccess: {
            items: (data) => data.data?.items || data.items,
            movie: (data) => data.movie,
            pagination: (data) => data.data?.params?.pagination || data.pagination
        }
    },
    nguonc: {
        id: 'nguonc',
        name: 'Nguồn 2 (NguonC)',
        base: "https://phim.nguonc.com/api",
        img_base: "",
        paths: {
            details: (slug) => `/film/${slug}`,
            category: (slug, page) => `/films/danh-sach/${slug}?page=${page}&limit=30`,
            search: (keyword, page) => `/films/search?keyword=${keyword}&page=${page}&limit=30`,
            homeCategory: (slug, page = 1) => `/films/danh-sach/${slug}?page=${page}&limit=20`
        },
        dataAccess: {
            items: (data) => data.items,
            movie: (data) => data.data || data.movie, 
            pagination: (data) => data.pagination,
            transform: (movie) => {
                const categories = movie.category || {};
                let year = ''; let countryList = []; let categoryList = [];
                for (const key in categories) {
                    const groupName = categories[key].group?.name;
                    if (groupName === 'Năm') year = categories[key].list[0]?.name || '';
                    else if (groupName === 'Quốc gia') countryList = categories[key].list;
                    else if (groupName === 'Thể loại') categoryList = categories[key].list;
                }
                return { name: movie.name, year, country: countryList, category: categoryList, actor: movie.casts ? movie.casts.split(',').map(s => s.trim()) : [], content: movie.description, episode_total: movie.total_episodes, slug: movie.slug, origin_name: movie.original_name, thumb_url: movie.thumb_url, poster_url: movie.poster_url, episode_current: movie.current_episode };
            }
        }
    },
    phimapi: {
        id: 'phimapi',
        name: 'Nguồn 3 (PhimAPI)',
        base: "https://phimapi.com",
        img_base: "https://img.phimapi.com/",
        paths: {
            details: (slug) => `/phim/${slug}`,
            category: (slug, page) => `/v1/api/danh-sach/${slug}?page=${page}&limit=30`,
            search: (keyword, page) => `/v1/api/tim-kiem?keyword=${keyword}&page=${page}&limit=30`,
            homeCategory: (slug) => `/v1/api/danh-sach/${slug}?limit=20&page=1`
        },
        dataAccess: {
            items: (data) => data.data?.items || data.items,
            movie: (data) => data.movie,
            pagination: (data) => data.data?.params?.pagination || data.pagination
        }
    }
};

function getCurrentApiConfig() {
    const sourceId = localStorage.getItem('apiSourceId') || 'ophim';
    return API_SOURCES[sourceId];
}

const pageContent = document.getElementById("page-content");
const paginationEl = document.getElementById("pagination");
const currentPageEl = document.getElementById("current-page");
const infoPopup = document.getElementById('movie-info-popup');
const popupOverlay = document.getElementById('popup-overlay');

const homeCategories = [
    { title: 'Phim Lẻ Mới', slug: 'phim-le' },
    { title: 'Phim Bộ Mới', slug: 'phim-bo' },
    { title: 'Phim Hoạt Hình', slug: 'hoat-hinh' },
    { title: 'TV Shows', slug: 'tv-shows' }
];

// Cập nhật hàm này để hiển thị nhãn tập cho lịch sử
function createMovieCard(movie, isFromHistory = false) {
    const config = getCurrentApiConfig();
    let finalImageUrl = '';
    const rawUrl = movie.thumb_url || movie.poster_url;

    if (rawUrl) {
        if (rawUrl.startsWith('http')) {
            finalImageUrl = rawUrl;
        } else {
            const imageBase = isFromHistory ? API_SOURCES[movie.source.id]?.img_base : config.img_base;
            finalImageUrl = imageBase + rawUrl;
        }
    }

    const episodeText = movie.episode_current || '';
    const langText = movie.lang || movie.language || '';
    
    let labelsHtml = '<div class="card-labels">';
    
    // Luôn hiển thị nhãn tập nếu có
    if (episodeText) {
        labelsHtml += `<div class="movie-label episode-label">${episodeText}</div>`;
    }

    // Chỉ hiển thị nhãn ngôn ngữ cho phim không thuộc lịch sử
    if (!isFromHistory && langText) {
        labelsHtml += `<div class="movie-label lang-label">${langText}</div>`;
    }
    
    // Hiển thị nhãn nguồn cho phim trong lịch sử
    if (isFromHistory && movie.source) {
        labelsHtml += `<div class="movie-label source-history-label">Nguồn ${movie.source.number}</div>`;
    }

    labelsHtml += '</div>';

    const div = document.createElement('div');
    div.className = 'movie-item';
    div.onclick = () => {
        if (isFromHistory && movie.source) {
            localStorage.setItem('apiSourceId', movie.source.id);
        }
        openInfoPopup(movie.slug)
    };

    div.innerHTML = `
        ${labelsHtml}
        <img src="${finalImageUrl}" alt="${movie.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/160x240/333/ccc?text=No+Image';">
        <h3>${movie.name}</h3>
        <p>${movie.origin_name || ''}</p>
    `;
    return div;
}

async function getMovieDetails(slug) {
    const currentSource = localStorage.getItem('apiSourceId') || 'ophim';
    const cacheKey = `${currentSource}-${slug}`;
    if (movieDetailsCache[cacheKey]) return movieDetailsCache[cacheKey];

    const config = getCurrentApiConfig();
    try {
        const res = await fetch(`${config.base}${config.paths.details(slug)}`);
        const data = await res.json();
        let movie = config.dataAccess.movie(data);

        if (movie) {
            if ((config.id === 'ophim' || config.id === 'phimapi') && movie.movie) {
                movie = movie.movie;
            }

            if (config.dataAccess.transform) {
                movie = config.dataAccess.transform(movie);
            }
            movieDetailsCache[cacheKey] = movie;
            return movie;
        }
        return null;
    } catch (err) {
        console.error(`Lỗi khi lấy chi tiết phim ${slug}:`, err);
        return null;
    }
}

async function fetchCategoryData(slug) {
    const config = getCurrentApiConfig();
    const currentSourceId = config.id;

    if (currentSourceId === 'nguonc') {
        try {
            const promise1 = fetch(`${config.base}${config.paths.homeCategory(slug, 1)}`).then(res => res.json());
            const promise2 = fetch(`${config.base}${config.paths.homeCategory(slug, 2)}`).then(res => res.json());

            const [data1, data2] = await Promise.all([promise1, promise2]);

            const items1 = config.dataAccess.items(data1) || [];
            const items2 = config.dataAccess.items(data2) || [];
            
            return [...items1, ...items2];
        } catch (err) {
            console.error(`Lỗi khi tải 2 trang cho danh mục ${slug}:`, err);
            return [];
        }
    } 
    else {
        try {
            const res = await fetch(`${config.base}${config.paths.homeCategory(slug)}`);
            const data = await res.json();
            return config.dataAccess.items(data) || [];
        } catch (err) {
            console.error(`Lỗi khi tải danh mục ${slug}:`, err);
            return [];
        }
    }
}

function renderHistorySection() {
    const historySection = document.getElementById('history-section');
    if (!historySection) return;
    
    const historyCarousel = historySection.querySelector('.movie-carousel');
    const historyData = JSON.parse(localStorage.getItem('watchHistoryList') || '[]');

    if (historyData.length > 0) {
        historySection.style.display = 'block';
        historyCarousel.innerHTML = ''; 

        historyData.forEach(movie => {
            const movieCard = createMovieCard(movie, true);
            historyCarousel.appendChild(movieCard);
        });
        
        attachCarouselEventsForSection(historySection);
    } else {
        historySection.style.display = 'none';
    }
}

async function renderHomepage() {
    currentView = { type: 'homepage' };
    pageContent.innerHTML = '<div style="text-align:center; padding: 50px;">Đang tải danh sách phim...</div>';
    paginationEl.classList.add('hidden');

    let allSectionsHtml = `
        <section id="history-section" class="category-section" style="display: none;">
            <div class="category-header">
                <h2 class="category-title">Lịch sử xem phim</h2>
                <a href="#" class="see-more-link" onclick="event.preventDefault(); showHistoryPage()">
                    Xem thêm <i class="fas fa-chevron-right"></i>
                </a>
            </div>
            <div class="movie-carousel"></div>
            <button class="carousel-nav-btn prev"><i class="fas fa-chevron-left"></i></button>
            <button class="carousel-nav-btn next"><i class="fas fa-chevron-right"></i></button>
        </section>
    `;

    for (const category of homeCategories) {
        allSectionsHtml += `
            <section class="category-section" data-slug="${category.slug}">
                <div class="category-header">
                    <h2 class="category-title">${category.title}</h2>
                    <a href="#" class="see-more-link" onclick="event.preventDefault(); showCategoryPage('${category.slug}', '${category.title}')">
                        Xem thêm <i class="fas fa-chevron-right"></i>
                    </a>
                </div>
                <div class="movie-carousel"></div>
                <button class="carousel-nav-btn prev"><i class="fas fa-chevron-left"></i></button>
                <button class="carousel-nav-btn next"><i class="fas fa-chevron-right"></i></button>
            </section>
        `;
    }
    pageContent.innerHTML = allSectionsHtml;

    renderHistorySection();

    for (const category of homeCategories) {
        const movies = await fetchCategoryData(category.slug);
        const section = pageContent.querySelector(`.category-section[data-slug="${category.slug}"]`);
        if (movies && movies.length > 0) {
            const carousel = section.querySelector('.movie-carousel');
            movies.slice(0, 20).forEach(movie => carousel.appendChild(createMovieCard(movie)));
            attachCarouselEventsForSection(section);
        } else {
            if(section) section.style.display = 'none';
        }
    }
}

function showHistoryPage() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    pageContent.innerHTML = ''; 
    paginationEl.classList.add('hidden'); 

    const historyData = JSON.parse(localStorage.getItem('watchHistoryList') || '[]');
    
    const titleEl = document.createElement('h2');
    titleEl.id = 'section-title';
    titleEl.textContent = 'Lịch sử xem phim';
    pageContent.appendChild(titleEl);

    if (historyData.length > 0) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'movie-grid';
        historyData.forEach(movie => {
            const movieCard = createMovieCard(movie, true); 
            gridContainer.appendChild(movieCard);
        });
        pageContent.appendChild(gridContainer);
    } else {
        pageContent.innerHTML += '<p style="text-align: center; margin-top: 20px;">Lịch sử xem phim của bạn trống.</p>';
    }
    
    currentView = { type: 'history' };
}


async function fetchAndShowPaginatedResults(url, title, page) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    pageContent.innerHTML = '<div style="text-align:center; padding: 50px;">Đang tải...</div>';
    
    const config = getCurrentApiConfig();
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        const movies = config.dataAccess.items(data) || [];
        const pagination = config.dataAccess.pagination(data);

        const titleEl = document.createElement('h2');
        titleEl.id = 'section-title';
        titleEl.innerHTML = title;

        if (movies && movies.length > 0) {
            const gridContainer = document.createElement('div');
            gridContainer.className = 'movie-grid';
            movies.forEach(movie => gridContainer.appendChild(createMovieCard(movie)));
            pageContent.innerHTML = '';
            pageContent.appendChild(titleEl);
            pageContent.appendChild(gridContainer);
            
            currentPageEl.textContent = pagination?.currentPage || page;
            paginationEl.classList.remove('hidden');
        } else {
            if (page > 1) {
                alert("Không có thêm kết quả. Quay lại trang trước.");
                if (currentView.type === 'search') searchMovies(currentView.query, page - 1);
                else if (currentView.type === 'category') showCategoryPage(currentView.slug, currentView.title, page - 1);
            } else {
                pageContent.innerHTML = `<h2>${title}</h2><p style="text-align: center; margin-top: 20px;">Không tìm thấy kết quả nào.</p>`;
                paginationEl.classList.add('hidden');
            }
        }
    } catch (err) {
        pageContent.innerHTML = "Lỗi khi tải phim.";
        paginationEl.classList.add('hidden');
        console.error(err);
    }
}

function showCategoryPage(slug, title, page = 1) {
    currentView = { type: 'category', slug, title };
    currentPage = page;
    const config = getCurrentApiConfig();
    const url = `${config.base}${config.paths.category(slug, page)}`;
    fetchAndShowPaginatedResults(url, title, page);
}

function searchMovies(query = null, page = 1) {
    const searchQuery = query || document.getElementById("search-input").value.trim();
    if (!searchQuery) return;
    
    currentView = { type: 'search', query: searchQuery };
    currentPage = page;
    const config = getCurrentApiConfig();
    const url = `${config.base}${config.paths.search(searchQuery, page)}`;
    fetchAndShowPaginatedResults(url, `🔍 Kết quả cho: "${searchQuery}"`, page);
}

async function openInfoPopup(slug) {
    popupOverlay.style.display = 'block';
    infoPopup.style.display = 'block';
    infoPopup.innerHTML = 'Đang tải...';

    const details = await getMovieDetails(slug);
    if (details) {
        const isTrailer = details.episode_current?.toLowerCase() === 'trailer';
        const hasNoEpisodes = !details.episode_total || details.episode_total == 0;
        const shouldDisableButton = isTrailer || hasNoEpisodes;
        const watchButtonHtml = `<button class="popup-watch-btn" onclick="startWatching('${slug}')"><i class="fas fa-play"></i> Xem ngay</button>`;
        
        let disabledButtonText;
        if(isTrailer) {
            disabledButtonText = 'Chỉ có Trailer';
        } else {
            disabledButtonText = 'Chưa có tập';
        }

        infoPopup.innerHTML = `
            <button class="popup-close-btn" onclick="closeInfoPopup()">×</button>
            <div class="info-title">${details.name || 'N/A'}</div>
            <div class="info-item"><strong>Năm:</strong> ${details.year || 'N/A'}</div>
            <div class="info-item"><strong>Quốc gia:</strong> ${details.country?.map(c => c.name).join(', ') || 'N/A'}</div>
            <div class="info-item"><strong>Thể loại:</strong> ${details.category?.map(c => c.name).join(', ') || 'N/A'}</div>
            <div class="info-item"><strong>Diễn viên:</strong> ${details.actor?.join(', ') || 'N/A'}</div>
            <div class="info-item"><strong>Số tập:</strong> ${details.episode_total || 'N/A'}</div>
            <div class="info-item info-description">${(details.content || '').replace(/<[^>]*>?/gm, '')}</div>
            <div class="popup-actions">
                <button class="popup-share-btn" onclick="shareMovie('${slug}', \`${details.name}\`)"><i class="fas fa-share-alt"></i> Chia sẻ</button>
                ${shouldDisableButton 
                    ? `<button class="popup-watch-btn" disabled>${disabledButtonText}</button>` 
                    : watchButtonHtml
                }
            </div>
        `;
    } else {
        infoPopup.innerHTML = 'Lỗi tải thông tin phim. Vui lòng thử lại.';
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const fabContainer = document.getElementById('fab-container');
    const optionsFab = document.getElementById('options-fab');
    if (fabContainer && optionsFab) {
        optionsFab.addEventListener('click', () => {
            fabContainer.classList.toggle('open');
        });
    }

    const sourceToggleBtn = document.getElementById('source-toggle-btn');
    const sourceSelectorOverlay = document.getElementById('source-selector-overlay');
    const sourceSelectorPanel = document.getElementById('source-selector-panel');
    const closeBtn = document.getElementById('close-source-selector-btn');

    const openPanel = () => {
        const contentDiv = document.getElementById('source-selector-content');
        contentDiv.innerHTML = '';
        const currentSourceId = getCurrentApiConfig().id;

        Object.values(API_SOURCES).forEach((source, index) => {
            const button = document.createElement('button');
            button.className = 'source-btn';
            button.textContent = `${index + 1}. ${source.name}`;
            button.dataset.sourceId = source.id;
            
            if (source.id === currentSourceId) {
                button.disabled = true;
            }

            button.addEventListener('click', () => {
                localStorage.setItem('apiSourceId', source.id);
                alert(`Đã đổi sang ${source.name}. Trang sẽ được tải lại.`);
                window.location.reload();
            });
            contentDiv.appendChild(button);
        });

        sourceSelectorOverlay.style.display = 'block';
        sourceSelectorPanel.style.display = 'block';
    };

    const closePanel = () => {
        sourceSelectorOverlay.style.display = 'none';
        sourceSelectorPanel.style.display = 'none';
    };

    const updateSourceIcon = () => {
        const sourceIcon = document.getElementById('source-icon');
        const currentSourceId = getCurrentApiConfig().id;
        const sourceKeys = Object.keys(API_SOURCES);
        const currentIndex = sourceKeys.indexOf(currentSourceId);
        if(sourceIcon) sourceIcon.textContent = currentIndex + 1;
    };
    
    if (sourceToggleBtn) {
        sourceToggleBtn.addEventListener('click', openPanel);
        closeBtn.addEventListener('click', closePanel);
        sourceSelectorOverlay.addEventListener('click', closePanel);
        updateSourceIcon();
    }
    
    const themeToggleBtn = document.getElementById('theme-toggle-btn'), body = document.body;
    if (themeToggleBtn && body) {
        const icon = themeToggleBtn.querySelector('i');
        const updateThemeIcon = () => icon.className = `fas fa-${body.classList.contains('light-mode') ? 'moon' : 'sun'}`;
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') body.classList.add('light-mode');
        updateThemeIcon();
        themeToggleBtn.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            localStorage.setItem('theme', body.classList.contains('light-mode') ? 'light' : 'dark');
            updateThemeIcon();
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const searchQueryFromUrl = urlParams.get('search_query');
    if (searchQueryFromUrl) {
        document.getElementById('search-input').value = decodeURIComponent(searchQueryFromUrl);
        searchMovies(decodeURIComponent(searchQueryFromUrl));
    } else {
        renderHomepage();
    }
    
    const searchInput = document.getElementById('search-input'), clearSearchBtn = document.getElementById('clear-search-btn');
    if(searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if(clearSearchBtn) clearSearchBtn.style.display = searchInput.value.length > 0 ? 'block' : 'none';
            if (e.key === 'Enter') searchMovies();
        });
    }
    if(clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            searchInput.focus();
        });
    }
    
    document.getElementById('logo-link').addEventListener('click', (e) => { e.preventDefault(); clearFilters(); });
    if(popupOverlay) popupOverlay.addEventListener('click', closeInfoPopup);
});

function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage < 1) return;

    const config = getCurrentApiConfig();
    let url = '';
    let title = currentView.title || 'Kết quả';

    if (currentView.type === 'category') {
        url = `${config.base}${config.paths.category(currentView.slug, newPage)}`;
    } else if (currentView.type === 'search') {
        url = `${config.base}${config.paths.search(currentView.query, newPage)}`;
    }
    
    if(url) {
        currentPage = newPage;
        fetchAndShowPaginatedResults(url, title, newPage);
    }
}


function clearFilters() {
    document.getElementById("search-input").value = "";
    document.getElementById('clear-search-btn').style.display = 'none';
    renderHomepage();
}

function attachCarouselEventsForSection(section) {
    const carousel = section.querySelector('.movie-carousel');
    const prevBtn = section.querySelector('.carousel-nav-btn.prev');
    const nextBtn = section.querySelector('.carousel-nav-btn.next');
    if (!carousel || !prevBtn || !nextBtn) return;

    const updateNavButtons = () => {
        const buffer = 2;
        const scrollLeft = carousel.scrollLeft;
        const scrollWidth = carousel.scrollWidth;
        const clientWidth = carousel.clientWidth;
        prevBtn.disabled = scrollLeft < buffer;
        nextBtn.disabled = scrollLeft + clientWidth >= scrollWidth - buffer;
    };
    prevBtn.addEventListener('click', () => carousel.scrollBy({ left: -carousel.clientWidth, behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' }));
    carousel.addEventListener('scroll', updateNavButtons, { passive: true });
    new ResizeObserver(updateNavButtons).observe(carousel);
    updateNavButtons();

    if (section.id !== 'history-section') {
        let autoSlideInterval;
        const startAutoSlide = () => {
            clearInterval(autoSlideInterval);
            const randomInterval = Math.random() * 5000 + 7000; 

            autoSlideInterval = setInterval(() => {
                if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1) {
                    carousel.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    carousel.scrollBy({ left: 175, behavior: 'smooth' });
                }
            }, randomInterval);
        };

        const stopAutoSlide = () => {
            clearInterval(autoSlideInterval);
        };

        section.addEventListener('mouseenter', stopAutoSlide);
        section.addEventListener('mouseleave', startAutoSlide);
        startAutoSlide();
    }
}

function attachCarouselEvents() {
    document.querySelectorAll('.category-section').forEach(section => {
        if(section.id !== 'history-section') {
             attachCarouselEventsForSection(section);
        }
    });
}

function closeInfoPopup() {
    if(popupOverlay) popupOverlay.style.display = 'none';
    if(infoPopup) {
        infoPopup.style.display = 'none';
        infoPopup.innerHTML = '';
    }
}

function startWatching(slug) { 
    window.location.href = `watch.html?slug=${slug}`; 
}

async function shareMovie(slug, title) {
    const shareData = { title: `Phim: ${title}`, text: `Cùng xem phim "${title}" nhé!`, url: `${window.location.origin}${window.location.pathname}?phim=${slug}` };
    if (navigator.share) {
        try { await navigator.share(shareData); } catch (err) { console.error("Lỗi khi chia sẻ:", err); }
    } else {
        try { await navigator.clipboard.writeText(shareData.url); alert("Đã sao chép link phim vào clipboard!"); } catch (err) { alert("Không thể sao chép link."); }
    }
}