// shared.js

// --- 1. CẤU HÌNH & TRẠNG THÁI TOÀN CỤC ---

/**
 * Nơi duy nhất chứa thông tin cấu hình của tất cả các API.
 * Bao gồm đầy đủ các đường dẫn (paths) cho mọi tính năng.
 */
const API_SOURCES = {
    ophim: {
        id: 'ophim',
        name: 'Nguồn 1 (Ổ Phim)',
        base: "https://ophim1.com",
        img_base: "https://img.ophim.live/uploads/movies/",
        paths: {
            details: (slug) => `/phim/${slug}`,
            category: (slug, page) => `/v1/api/danh-sach/${slug}?page=${page}&limit=14`,
            search: (keyword, page) => `/v1/api/tim-kiem?keyword=${keyword}&page=${page}&limit=14`,
            homeCategory: (slug) => `/v1/api/danh-sach/${slug}?limit=20&page=1`,
            sliderList: (limit) => `/v1/api/danh-sach/phim-moi-cap-nhat?limit=${limit}`,
            related: () => `/v1/api/danh-sach/phim-le?limit=20&page=1`
        },
        dataAccess: {
            items: (data) => data.data?.items || data.items,
            movie: (data) => data.movie,
            pagination: (data) => data.data?.params?.pagination || data.pagination,
            episodes: (data) => data.episodes,
            relatedItems: (data) => data.data?.items
        }
    },
    nguonc: {
        id: 'nguonc',
        name: 'Nguồn 2 (Phim Nguồn C)',
        base: "https://phim.nguonc.com/api",
        img_base: "",
        paths: {
            details: (slug) => `/film/${slug}`,
            category: (slug, page) => `/films/danh-sach/${slug}?page=${page}&limit=14`,
            search: (keyword, page) => `/films/search?keyword=${keyword}&page=${page}&limit=14`,
            homeCategory: (slug, page = 1) => `/films/danh-sach/phim-le?page=${page}&limit=20`,
            sliderList: (limit) => `/films/danh-sach/phim-le?page=1&limit=${limit}`,
            related: () => `/films/danh-sach/phim-le?page=1`
        },
        dataAccess: {
            items: (data) => data.items,
            movie: (data) => data.movie || data.data,
            pagination: (data) => data.pagination,
            episodes: (data) => data.movie?.episodes,
            relatedItems: (data) => data.items,
            transform: (movie) => {
                const categories = movie.category || {};
                let year = ''; let countryList = []; let categoryList = [];
                for (const key in categories) {
                    const groupName = categories[key].group?.name;
                    if (groupName === 'Năm') year = categories[key].list[0]?.name || '';
                    else if (groupName === 'Quốc gia') countryList = categories[key].list;
                    else if (groupName === 'Thể loại') categoryList = categories[key].list;
                }
                return { name: movie.name, year, country: countryList, category: categoryList, actor: movie.casts ? movie.casts.split(',').map(s => s.trim()) : [], content: movie.description, episode_total: movie.total_episodes, slug: movie.slug, origin_name: movie.original_name, thumb_url: movie.thumb_url, poster_url: movie.poster_url, episode_current: movie.episode_current };
            }
        }
    },
    phimapi: {
        id: 'phimapi',
        name: 'Nguồn 3 (KK Phim)',
        base: "https://phimapi.com",
        img_base: "https://phimimg.com/",
        paths: {
            details: (slug) => `/phim/${slug}`,
            category: (slug, page) => `/v1/api/danh-sach/${slug}?page=${page}&limit=14`,
            search: (keyword, page) => `/v1/api/tim-kiem?keyword=${keyword}&page=${page}&limit=14`,
            homeCategory: (slug) => `/v1/api/danh-sach/${slug}?limit=20&page=1`,
            sliderList: (limit) => `/v1/api/danh-sach/tv-shows?limit=${limit}`,
            related: () => `/v1/api/danh-sach/phim-le?limit=20&page=1`
        },
        dataAccess: {
            items: (data) => data.data?.items,
            movie: (data) => data.movie,
            pagination: (data) => data.data?.params?.pagination || data.pagination,
            episodes: (data) => data.episodes,
            relatedItems: (data) => data.data?.items
        }
    }
};

const movieDetailsCache = {};
let alertCountdownInterval;

/**
 * Lấy cấu hình cho nguồn API đang được chọn.
 * @returns {object} Đối tượng cấu hình API.
 */
function getCurrentApiConfig() {
    const sourceId = localStorage.getItem('apiSourceId') || 'ophim';
    return API_SOURCES[sourceId];
}

// --- 2. HÀM API & DỮ LIỆU DÙNG CHUNG ---

/**
 * Lấy và lưu cache chi tiết phim.
 * @param {string} slug - Slug của phim.
 * @returns {Promise<object|null>} Đối tượng chi tiết phim.
 */
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

// --- 3. HÀM TẠO GIAO DIỆN DÙNG CHUNG ---

/**
 * Tạo một thẻ phim (movie card) trong DOM.
 * @param {object} movie - Đối tượng dữ liệu phim.
 * @param {boolean} isFromHistory - Cờ để điều chỉnh giao diện cho mục lịch sử.
 * @returns {HTMLElement} Phần tử DOM của thẻ phim.
 */
/**
 * Tạo một thẻ phim (movie card) với thiết kế chuyên nghiệp mới
 * @param {object} movie - Đối tượng dữ liệu phim.
 * @returns {HTMLElement} Phần tử DOM của thẻ phim.
 */
/**
 * Tạo một thẻ phim (movie card) với thiết kế chuyên nghiệp mới
 * @param {object} movie - Đối tượng dữ liệu phim.
 * @param {boolean} isFromHistory - Cờ để xác định có phải phim từ lịch sử không.
 * @returns {HTMLElement} Phần tử DOM của thẻ phim.
 */
/**
 * Tạo một thẻ phim (movie card) - PHIÊN BẢN CHỐNG LỖI DỮ LIỆU
 * @param {object} movie - Đối tượng dữ liệu phim.
 * @param {boolean} isFromHistory - Cờ để xác định có phải phim từ lịch sử không.
 * @returns {HTMLElement} Phần tử DOM của thẻ phim.
 */
function createMovieCard(movie, isFromHistory = false, isFromFavorites = false) {
    if (!movie || !movie.slug) {
        console.error('Dữ liệu phim không hợp lệ, đã được bỏ qua:', movie);
        return document.createDocumentFragment();
    }

    const config = getCurrentApiConfig();
    const finalImageUrl = movie.thumb_url || movie.poster_url;
    const imageUrl = finalImageUrl 
        ? (finalImageUrl.startsWith('http') ? finalImageUrl : config.img_base + finalImageUrl) 
        : 'https://placehold.co/240x360/1a1a1a/555?text=No+Image';
        
    const name = movie.name || 'Tên không xác định';
    const year = movie.year || 'N/A';
    const episode = movie.episode_current || 'N/A';
    const country = movie.country?.[0]?.name || 'N/A';
    const language = movie.lang || movie.language || 'N/A';
    const slug = movie.slug;

    const div = document.createElement('div');
    div.className = 'movie-item';

    let deleteButtonHtml = '';
    if (isFromHistory) {
        deleteButtonHtml = `<button class="delete-history-btn" onclick="deleteFromHistory('${slug}', this)" title="Xóa khỏi lịch sử">&times;</button>`;
    } else if (isFromFavorites) {
        deleteButtonHtml = `<button class="delete-favorite-btn" onclick="deleteFromFavorites('${slug}', this)" title="Xóa khỏi yêu thích">&times;</button>`;
    }

    div.innerHTML = `
        ${deleteButtonHtml}
        <div class="card-poster">
            <img src="${imageUrl}" alt="${name}" loading="lazy">
            <div class="card-labels">
                <span class="card-label label-country">${country}</span>
                <span class="card-label label-language">${language}</span>
            </div>
            <div class="card-content-overlay">
                <h3>${name}</h3>
                <div class="card-meta">
                    <span class="meta-year">${year}</span>
                    <span class="meta-episode">${episode}</span>
                </div>
            </div>
            <div class="card-interaction-overlay">
                <i class="fas fa-play play-icon"></i>
            </div>
        </div>
    `;

    const interactionOverlay = div.querySelector('.card-interaction-overlay');
    if (interactionOverlay) {
        interactionOverlay.onclick = () => {
            window.location.href = `movie.html?slug=${slug}`;
        };
    }

    return div;
}
/**
 * Mở popup hiển thị chi tiết phim.
 * @param {string} slug - Slug của phim.
 */
async function openInfoPopup(slug) {
    const popupOverlay = document.getElementById('popup-overlay');
    const infoPopup = document.getElementById('movie-info-popup');
    if (!popupOverlay || !infoPopup) return;

    popupOverlay.style.display = 'block';
    infoPopup.style.display = 'block';
    infoPopup.innerHTML = '<div style="text-align:center; padding: 40px;">Đang tải...</div>';

    const details = await getMovieDetails(slug);
    if (details) {
        const favorites = JSON.parse(localStorage.getItem('favoriteMovies') || '[]');
        const isFavorited = favorites.some(movie => movie.slug === slug);

        const isTrailer = details.episode_current?.toLowerCase() === 'trailer';
        const hasNoEpisodes = !details.episode_total || details.episode_total == 0;
        const shouldDisableButton = isTrailer || hasNoEpisodes;
        
        let watchButtonHtml;
        if (shouldDisableButton) {
            const disabledText = isTrailer ? 'Chỉ có Trailer' : 'Chưa có tập';
            watchButtonHtml = `<button class="popup-watch-btn" disabled>${disabledText}</button>`;
        } else {
            watchButtonHtml = `<button class="popup-watch-btn" onclick="startWatching('${slug}')"><i class="fas fa-play"></i> Xem ngay</button>`;
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
                <button class="popup-favorite-btn ${isFavorited ? 'active' : ''}" onclick="toggleFavorite('${slug}', this)">
                    <i class="fas fa-heart"></i>
                </button>
                ${watchButtonHtml}
            </div>
        `;
        popupOverlay.onclick = closeInfoPopup;
    } else {
        infoPopup.innerHTML = '<div style="text-align:center; padding: 40px;">Lỗi tải thông tin phim. Vui lòng thử lại.</div>';
    }
}

/** Đóng popup chi tiết phim. */
function closeInfoPopup() {
    const popupOverlay = document.getElementById('popup-overlay');
    const infoPopup = document.getElementById('movie-info-popup');
    if (popupOverlay) popupOverlay.style.display = 'none';
    if (infoPopup) {
        infoPopup.style.display = 'none';
        infoPopup.innerHTML = '';
    }
}

/** Chuyển đến trang xem phim. */
function startWatching(slug) {
    window.location.href = `watch.html?slug=${slug}`;
}

/** Thêm/Xóa phim khỏi danh sách yêu thích. */
async function toggleFavorite(slug, button) {
    let favorites = JSON.parse(localStorage.getItem('favoriteMovies') || '[]');
    const movieIndex = favorites.findIndex(movie => movie.slug === slug);

    if (movieIndex > -1) {
        favorites.splice(movieIndex, 1);
        button.classList.remove('active');
        showCustomAlert('Đã xóa khỏi danh sách yêu thích.', 1500);
    } else {
        const movieDetails = await getMovieDetails(slug);
        if (movieDetails) {
            const config = getCurrentApiConfig();
            const sourceIndex = Object.keys(API_SOURCES).indexOf(config.id);
            const favoriteData = {
                slug: movieDetails.slug,
                name: movieDetails.name,
                origin_name: movieDetails.origin_name,
                thumb_url: movieDetails.thumb_url,
                poster_url: movieDetails.poster_url,
                year: movieDetails.year,
                episode_current: movieDetails.episode_current || '',
                source: { id: config.id, name: config.name, number: sourceIndex + 1 }
            };
            favorites.unshift(favoriteData);
            button.classList.add('active');
            showCustomAlert('Đã thêm vào danh sách yêu thích.', 1500);
        }
    }
    localStorage.setItem('favoriteMovies', JSON.stringify(favorites));

    // Nếu có section 'favorites-section' trên trang, render lại nó
    if (document.getElementById('favorites-section') && typeof renderFavoritesSection === 'function') {
        renderFavoritesSection();
    }
}

/** Hiển thị thông báo tùy chỉnh. */
function showCustomAlert(message, durationInMs, callback) {
    const overlay = document.getElementById('custom-alert-overlay');
    const popup = document.getElementById('custom-alert-popup');
    const messageEl = document.getElementById('custom-alert-message');
    const countdownEl = document.getElementById('custom-alert-countdown');
    if (!overlay || !popup || !messageEl || !countdownEl) {
        alert(message);
        if (callback) callback();
        return;
    }

    messageEl.textContent = message;
    overlay.style.display = 'block';
    popup.style.display = 'flex';
    clearInterval(alertCountdownInterval);
    let secondsLeft = Math.ceil(durationInMs / 1000);

    const hasCountdown = !!callback;
    countdownEl.style.display = hasCountdown ? 'block' : 'none';
    document.getElementById('custom-alert-ok-btn').style.display = hasCountdown ? 'none' : 'block';

    if(hasCountdown) {
        const updateCountdownText = () => {
             countdownEl.textContent = `Tự động chuyển sau ${secondsLeft}s...`;
        };
        updateCountdownText();
        alertCountdownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                clearInterval(alertCountdownInterval);
                countdownEl.textContent = 'Đang chuyển trang...';
            } else {
                updateCountdownText();
            }
        }, 1000);
    }
    
    setTimeout(() => {
        clearInterval(alertCountdownInterval);
        if(hasCountdown) {
            if (callback) callback();
        } else {
            overlay.style.display = 'none';
            popup.style.display = 'none';
        }
    }, durationInMs);
}

/**
 * Hiển thị hộp thoại xác nhận
 * @param {string} message - Thông điệp cần xác nhận.
 * @param {function} onConfirm - Hàm sẽ được gọi khi người dùng bấm "Xác nhận".
 */
function showCustomConfirm(message, onConfirm) {
    const overlay = document.getElementById('custom-confirm-overlay');
    const popup = document.getElementById('custom-confirm-popup');
    const messageEl = document.getElementById('custom-confirm-message');
    const okBtn = document.getElementById('custom-confirm-ok-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

    if (!overlay || !popup || !messageEl || !okBtn || !cancelBtn) return;

    messageEl.textContent = message;
    overlay.style.display = 'block';
    popup.style.display = 'block';

    const closePopup = () => {
        overlay.style.display = 'none';
        popup.style.display = 'none';
        // Gỡ bỏ event listener để tránh bị gọi nhiều lần
        okBtn.replaceWith(okBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };

    okBtn.onclick = () => {
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
        closePopup();
    };

    cancelBtn.onclick = closePopup;
    overlay.onclick = closePopup;
}
// --- 4. HÀM KHỞI TẠO GIAO DIỆN DÙNG CHUNG ---

/**
 * Khởi tạo các thành phần giao diện chung cho tất cả các trang.
 * @param {function} searchHandler - Hàm xử lý khi người dùng tìm kiếm.
 */
function initializeSharedUI(searchHandler) {
    // FAB Menu
    const fabContainer = document.getElementById('fab-container');
    if (fabContainer) {
        fabContainer.addEventListener('click', (e) => {
            if (e.target.closest('#options-fab')) {
                 fabContainer.classList.toggle('open');
            }
        });
    }

    // Nút đổi theme
    const themeToggleBtn = document.getElementById('theme-toggle-btn'), body = document.body;
    if (themeToggleBtn && body) {
        const icon = themeToggleBtn.querySelector('i');
        const updateThemeIcon = () => icon.className = `fas fa-${body.classList.contains('light-mode') ? 'moon' : 'sun'}`;
        if (localStorage.getItem('theme') === 'light') body.classList.add('light-mode');
        updateThemeIcon();
        themeToggleBtn.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            localStorage.setItem('theme', body.classList.contains('light-mode') ? 'light' : 'dark');
            updateThemeIcon();
        });
    }
    
    // Panel chọn nguồn phim
    const sourceToggleBtn = document.getElementById('source-toggle-btn');
    const sourceSelectorOverlay = document.getElementById('source-selector-overlay');
    const sourceSelectorPanel = document.getElementById('source-selector-panel');
    const closeBtn = document.getElementById('close-source-selector-btn');
    if(sourceToggleBtn && sourceSelectorOverlay && sourceSelectorPanel && closeBtn) {
        const openPanel = () => {
            const contentDiv = document.getElementById('source-selector-content');
            contentDiv.innerHTML = '';
            const currentSourceId = getCurrentApiConfig().id;
    
            Object.values(API_SOURCES).forEach((source, index) => {
                const button = document.createElement('button');
                button.className = 'source-btn';
                button.textContent = `${index + 1}. ${source.name}`;
                if (source.id === currentSourceId) button.disabled = true;
    
                button.addEventListener('click', () => {
                    localStorage.setItem('apiSourceId', source.id);
                    closePanel();
                    showCustomAlert(`Đã đổi sang ${source.name}.`, 2000, () => {
                         // Luôn chuyển về trang chủ khi đổi nguồn để tránh lỗi
                        window.location.href = 'index.html';
                    });
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
        sourceToggleBtn.addEventListener('click', openPanel);
        closeBtn.addEventListener('click', closePanel);
        sourceSelectorOverlay.addEventListener('click', closePanel);
    }
    const updateSourceIcon = () => {
        const sourceIcon = document.getElementById('source-icon');
        const sourceKeys = Object.keys(API_SOURCES);
        const currentIndex = sourceKeys.indexOf(getCurrentApiConfig().id);
        if (sourceIcon) sourceIcon.textContent = currentIndex + 1;
    };
    updateSourceIcon();


    // Header cuộn
    const headerEl = document.querySelector('header');
    if (headerEl) {
        window.addEventListener('scroll', () => {
            headerEl.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }
    
    // Thanh tìm kiếm
    const searchInput = document.getElementById('search-input');
    const searchGroup = document.querySelector('.search-group');
    const searchBtn = document.getElementById('search-btn');
    const headerContainer = document.querySelector('.header-container');
    if (searchGroup && searchInput && searchBtn && headerContainer) {
        searchBtn.addEventListener('click', (e) => {
            if (!searchGroup.classList.contains('active')) {
                e.preventDefault();
                searchGroup.classList.add('active');
                headerContainer.classList.add('search-active');
                searchInput.focus();
            } else if (searchInput.value.trim() !== '' && typeof searchHandler === 'function') {
                searchHandler(searchInput.value.trim());
            } else {
                searchGroup.classList.remove('active');
                headerContainer.classList.remove('search-active');
            }
        });

        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' && typeof searchHandler === 'function') {
                searchHandler(searchInput.value.trim());
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchGroup.contains(e.target) && searchInput.value === '') {
                searchGroup.classList.remove('active');
                headerContainer.classList.remove('search-active');
            }
        });
    }

    // Popup và Overlay
    const popupOverlay = document.getElementById('popup-overlay');
    if(popupOverlay) popupOverlay.addEventListener('click', closeInfoPopup);

    const alertOkBtn = document.getElementById('custom-alert-ok-btn');
    if(alertOkBtn) {
        alertOkBtn.addEventListener('click', () => {
            document.getElementById('custom-alert-overlay').style.display = 'none';
            document.getElementById('custom-alert-popup').style.display = 'none';
        });
    }
}
/**
 * Xóa một phim khỏi lịch sử xem
 * @param {string} slug - Slug của phim cần xóa.
 * @param {HTMLElement} buttonElement - Nút bấm được click.
 */
function deleteFromHistory(slug, buttonElement) {
    event.stopPropagation();
    showCustomConfirm("Bạn có chắc chắn muốn xóa phim này khỏi lịch sử?", () => {
        let history = JSON.parse(localStorage.getItem('watchHistoryList') || '[]');
        const updatedHistory = history.filter(movie => movie.slug !== slug);
        localStorage.setItem('watchHistoryList', JSON.stringify(updatedHistory));

        const movieCard = buttonElement.closest('.movie-item');
        if (movieCard) {
            movieCard.style.transition = 'opacity 0.3s ease';
            movieCard.style.opacity = '0';
            setTimeout(() => {
                movieCard.remove();
                const container = movieCard.parentElement;
                if (container && container.children.length === 0) {
                    const section = container.closest('.category-section');
                    if (section) section.style.display = 'none';
                }
            }, 300);
        }
    });
}

function deleteFromFavorites(slug, buttonElement) {
    event.stopPropagation();
    showCustomConfirm("Bạn có chắc chắn muốn xóa phim này khỏi danh sách yêu thích?", () => {
        let favorites = JSON.parse(localStorage.getItem('favoriteMovies') || '[]');
        const updatedFavorites = favorites.filter(movie => movie.slug !== slug);
        localStorage.setItem('favoriteMovies', JSON.stringify(updatedFavorites));
        
        showCustomAlert('Đã xóa khỏi danh sách yêu thích.', 1500);

        const movieCard = buttonElement.closest('.movie-item');
        if (movieCard) {
            movieCard.style.transition = 'opacity 0.3s ease';
            movieCard.style.opacity = '0';
            setTimeout(() => {
                movieCard.remove();
                const container = movieCard.parentElement;
                if (container && container.children.length === 0) {
                    if (container.id === 'favorites-grid') {
                        container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Bạn chưa có phim yêu thích nào.</p>';
                    } else {
                        const section = container.closest('.category-section');
                        if (section) section.style.display = 'none';
                    }
                }
            }, 300);
        }
    });
}