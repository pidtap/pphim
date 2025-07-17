let isAutoNextEnabled = true;
let currentEpisodeList = [];
let fullEpisodeData = [];
let currentMovieSlug = '';
let videoPlayer = null;
let currentMovieData = null;

const API_SOURCES = {
    ophim: {
        id: 'ophim',
        name: 'Nguồn 1 (Ophim)',
        base: "https://ophim1.com",
        img_base: "https://img.ophim.live/uploads/movies/",
        paths: {
            details: (slug) => `/phim/${slug}`,
            related: () => `/v1/api/danh-sach/phim-le?limit=20&page=1`
        },
        dataAccess: {
            movie: (data) => data.movie,
            episodes: (data) => data.episodes,
            relatedItems: (data) => data.data.items
        }
    },
    nguonc: {
        id: 'nguonc',
        name: 'Nguồn 2 (NguonC)',
        base: "https://phim.nguonc.com/api",
        img_base: "",
        paths: {
            details: (slug) => `/film/${slug}`,
            related: () => `/films/danh-sach/phim-le?page=1`
        },
        dataAccess: {
            movie: (data) => data.movie,
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
                return { name: movie.name, year, country: countryList, category: categoryList, slug: movie.slug, origin_name: movie.original_name, thumb_url: movie.thumb_url, poster_url: movie.poster_url, episode_current: movie.current_episode, content: movie.description };
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
            related: () => `/v1/api/danh-sach/phim-le?limit=20&page=1`
        },
        dataAccess: {
            movie: (data) => data.movie,
            episodes: (data) => data.episodes,
            relatedItems: (data) => data.data.items
        }
    }
};

function getCurrentApiConfig() {
    const sourceId = localStorage.getItem('apiSourceId') || 'ophim';
    return API_SOURCES[sourceId];
}

async function loadWatchPage(slug) {
    currentMovieSlug = slug;
    const config = getCurrentApiConfig();
    try {
        const res = await fetch(`${config.base}${config.paths.details(slug)}`);
        const data = await res.json();

        let movie = config.dataAccess.movie(data);
        if(!movie) throw new Error("Không tìm thấy dữ liệu phim.");

        if ((config.id === 'ophim' || config.id === 'phimapi') && movie.movie) {
            movie = movie.movie;
        }

        if (config.dataAccess.transform) {
            movie = config.dataAccess.transform(movie);
        }

        currentMovieData = movie;

        fullEpisodeData = config.dataAccess.episodes(data);
        if(!fullEpisodeData || fullEpisodeData.length === 0) throw new Error("Không tìm thấy danh sách tập phim.");

        document.title = movie.name;
        document.getElementById('movie-title').textContent = movie.name;
        document.getElementById('movie-meta-info').innerHTML = `
            <span class="meta-item"><strong>Năm:</strong> ${movie.year || 'N/A'}</span>
            <span class="meta-item"><strong>Quốc gia:</strong> ${movie.country?.map(c => c.name).join(', ') || 'N/A'}</span>
            <span class="meta-item"><strong>Thể loại:</strong> ${movie.category?.map(c => c.name).join(', ') || 'N/A'}</span>
        `;

        document.getElementById('movie-description-content').innerHTML = movie.content || 'Chưa có mô tả.';

        renderServerButtons();

        const savedServerIndex = getWatchProgress(currentMovieSlug)?.serverIndex;
        let initialServerButton = document.querySelector(`.server-btn[data-server-index="${savedServerIndex}"]`);
        if (!initialServerButton && document.querySelector('.server-btn')) {
            initialServerButton = document.querySelector('.server-btn');
        }

        if (initialServerButton) {
            initialServerButton.click();
        } else {
            updateEpisodeList(0);
        }

        loadRelatedMovies();

    } catch (error) {
        console.error("Lỗi khi tải trang xem phim:", error);
        document.getElementById('movie-title').textContent = "Lỗi khi tải thông tin phim.";
        document.getElementById('video-player-container').style.display = 'none';
    }
}

function renderServerButtons() {
    const serverSelectionDiv = document.getElementById('server-selection');
    const serverListDiv = document.getElementById('server-list');
    serverListDiv.innerHTML = '';

    if (fullEpisodeData.length > 1) {
        serverSelectionDiv.style.display = 'flex';
        fullEpisodeData.forEach((server, index) => {
            const button = document.createElement('button');
            button.className = 'server-btn';
            button.textContent = server.server_name;
            button.dataset.serverIndex = index;

            button.addEventListener('click', function() {
                document.querySelectorAll('.server-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                updateEpisodeList(index);
                saveWatchProgress(currentMovieSlug, null, index);
            });
            serverListDiv.appendChild(button);
        });
    } else {
        serverSelectionDiv.style.display = 'none';
        updateEpisodeList(0);
    }
}

function updateEpisodeList(serverIndex) {
    const serverData = fullEpisodeData[serverIndex];
    currentEpisodeList = serverData.items || serverData.server_data;

    const selectSelected = document.getElementById('select-selected');
    const selectItems = document.getElementById('select-items');
    const episodeInfo = document.getElementById('episode-info');
    const autoNextWrapper = document.getElementById('auto-next-wrapper');
    const currentSource = getCurrentApiConfig().id;

    selectItems.innerHTML = '';

    if (currentEpisodeList && currentEpisodeList.length > 1 && currentSource !== 'nguonc') {
        autoNextWrapper.style.display = 'flex';
    } else {
        autoNextWrapper.style.display = 'none';
    }

    if (currentEpisodeList && currentEpisodeList.length > 0) {
        currentEpisodeList.forEach((ep, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.textContent = ep.name;
            optionDiv.dataset.m3u8 = ep.m3u8 || ep.link_m3u8;
            optionDiv.dataset.embed = ep.embed;
            optionDiv.dataset.episodeIndex = index;

            optionDiv.addEventListener('click', function() {
                selectSelected.textContent = this.textContent;
                playEpisode(this.dataset.m3u8, this.dataset.embed, serverIndex, index);
                selectItems.classList.add('select-hide');

                selectItems.querySelectorAll('div').forEach(item => item.classList.remove('same-as-selected'));
                this.classList.add('same-as-selected');

                if (episodeInfo) {
                    episodeInfo.textContent = `Bạn đang xem tập: ${index + 1} / ${currentEpisodeList.length}`;
                }
            });
            selectItems.appendChild(optionDiv);
        });

        const lastWatchedProgress = getWatchProgress(currentMovieSlug);
        let episodeToPlay;

        if (lastWatchedProgress && lastWatchedProgress.serverIndex === serverIndex && lastWatchedProgress.episodeIndex !== undefined) {
             episodeToPlay = selectItems.querySelector(`div[data-episode-index="${lastWatchedProgress.episodeIndex}"]`);
        }

        if (!episodeToPlay && lastWatchedProgress && lastWatchedProgress.episodeLink) {
            episodeToPlay = selectItems.querySelector(`div[data-m3u8="${lastWatchedProgress.episodeLink}"]`) || selectItems.querySelector(`div[data-embed="${lastWatchedProgress.episodeLink}"]`);
        }

        if (!episodeToPlay) {
            episodeToPlay = selectItems.querySelector('div');
        }

        if (episodeToPlay) {
            episodeToPlay.click();
        }

    } else {
        selectSelected.textContent = 'Không có tập';
        if(episodeInfo) episodeInfo.textContent = '';
    }
}


async function loadRelatedMovies() {
    const relatedSection = document.getElementById('related-movies-section');
    const carouselContainer = document.getElementById('related-movies-carousel');
    const config = getCurrentApiConfig();
    try {
        const res = await fetch(`${config.base}${config.paths.related()}`);
        const data = await res.json();
        const movies = config.dataAccess.relatedItems(data);
        if (movies && movies.length > 0) {
            carouselContainer.innerHTML = '';
            movies.forEach(movie => {
                const movieCard = createMovieCardForWatchPage(movie);
                carouselContainer.appendChild(movieCard);
            });
            relatedSection.style.display = 'block';
            attachCarouselEventsForRelated();
        }
    } catch (error) {
        console.error("Lỗi khi tải phim đề xuất:", error);
    }
}

function createMovieCardForWatchPage(movie) {
    const config = getCurrentApiConfig();
    let finalImageUrl = '';
    const rawUrl = movie.thumb_url || movie.poster_url;

    if (rawUrl) {
        if (rawUrl.startsWith('http')) {
            finalImageUrl = rawUrl;
        } else {
            finalImageUrl = config.img_base + rawUrl;
        }
    }

    const episodeText = movie.episode_current || movie.current_episode || '';
    const langText = movie.lang || movie.language || '';
    let labelsHtml = '<div class="card-labels">';
    if (episodeText) labelsHtml += `<div class="movie-label episode-label">${episodeText}</div>`;
    if (langText) labelsHtml += `<div class="movie-label lang-label">${langText}</div>`;
    labelsHtml += '</div>';

    const div = document.createElement('div');
    div.className = 'movie-item';
    div.onclick = () => window.location.href = `watch.html?slug=${movie.slug}`;
    div.innerHTML = `
        ${labelsHtml}
        <img src="${finalImageUrl}" alt="${movie.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/160x240/333/ccc?text=No+Image';">
        <h3>${movie.name}</h3>
        <p>${movie.origin_name || ''}</p>
    `;
    return div;
}

document.addEventListener('DOMContentLoaded', () => {
    const fabContainer = document.getElementById('fab-container');
    const optionsFab = document.getElementById('options-fab');
    if (fabContainer && optionsFab) {
        optionsFab.addEventListener('click', () => {
            fabContainer.classList.toggle('open');
        });
    }

    const playerWrapper = document.getElementById('video-player-container');
    if (playerWrapper) {
        const iframePlayer = document.createElement('iframe');
        iframePlayer.id = 'iframe-player';
        iframePlayer.style.cssText = 'display: none; width: 100%; border: 0; aspect-ratio: 16 / 9;';
        iframePlayer.setAttribute('allowfullscreen', '');
        iframePlayer.setAttribute('frameborder', '0');
        iframePlayer.setAttribute('referrerpolicy', 'no-referrer');
        playerWrapper.appendChild(iframePlayer);
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
                alert(`Đã đổi sang ${source.name}. Đang quay về trang chủ.`);
                window.location.href = 'index.html';
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

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;
    if (themeToggleBtn && body) {
        const icon = themeToggleBtn.querySelector('i');
        const updateThemeIcon = () => {
            icon.className = `fas fa-${body.classList.contains('light-mode') ? 'moon' : 'sun'}`;
        };
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            body.classList.add('light-mode');
        }
        updateThemeIcon();
        themeToggleBtn.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            localStorage.setItem('theme', body.classList.contains('light-mode') ? 'light' : 'dark');
            updateThemeIcon();
        });
    }

    const headerEl = document.querySelector('header');
    if (headerEl) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                headerEl.classList.add('scrolled');
            } else {
                headerEl.classList.remove('scrolled');
            }
        });
    }

    const selectSelected = document.getElementById('select-selected');
    const selectItems = document.getElementById('select-items');
    if(selectSelected) {
        selectSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItems.classList.toggle('select-hide');
        });
    }

    const autoNextBtn = document.getElementById('auto-next-btn');
    if (autoNextBtn) {
        const savedAutoNextState = localStorage.getItem('isAutoNextEnabled');
        if (savedAutoNextState !== null) {
            isAutoNextEnabled = JSON.parse(savedAutoNextState);
        }
        autoNextBtn.classList.toggle('active', isAutoNextEnabled);
        const icon = autoNextBtn.querySelector('i');
        icon.className = isAutoNextEnabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off';

        autoNextBtn.addEventListener('click', () => {
            isAutoNextEnabled = !isAutoNextEnabled;
            autoNextBtn.classList.toggle('active', isAutoNextEnabled);
            const icon = autoNextBtn.querySelector('i');
            icon.className = isAutoNextEnabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
            localStorage.setItem('isAutoNextEnabled', JSON.stringify(isAutoNextEnabled));
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const movieSlug = urlParams.get('slug');

    if (movieSlug) {
        loadWatchPage(movieSlug);
    } else {
        document.getElementById('movie-title').textContent = "Không tìm thấy phim!";
    }

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
            } else {
                if (searchInput.value.trim() !== '') {
                    searchMoviesOnWatchPage(); 
                } else {
                    searchGroup.classList.remove('active');
                    headerContainer.classList.remove('search-active');
                }
            }
        });

        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                searchMoviesOnWatchPage();
            }
        });

        searchInput.addEventListener('search', () => {
            if (searchInput.value === '') { 
                searchGroup.classList.remove('active');
                headerContainer.classList.remove('search-active');
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchGroup.contains(e.target) && searchInput.value === '') {
                searchGroup.classList.remove('active');
                headerContainer.classList.remove('search-active');
            }
        });
    }
});


document.addEventListener("click", (e) => {
    const selectItems = document.getElementById('select-items');
    if (selectItems && !selectItems.classList.contains('select-hide') && !selectItems.parentElement.contains(e.target)) {
        selectItems.classList.add('select-hide');
    }
});

function playEpisode(m3u8Link, embedLink, serverIndex, episodeIndex) {
    if ((!m3u8Link || m3u8Link === 'undefined') && (!embedLink || embedLink === 'undefined')) {
        alert("Tập phim này hiện không có nguồn phát, vui lòng thử tập khác.");
        return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const playerContainer = document.getElementById('video-player-container');
    const videoJsPlayerEl = document.getElementById('my-video-player');
    const iframePlayerEl = document.getElementById('iframe-player');
    const currentSource = getCurrentApiConfig().id;

    playerContainer.style.display = 'block';

    if (currentSource === 'nguonc' && embedLink && embedLink !== 'undefined') {
        videoJsPlayerEl.style.display = 'none';
        if (videoPlayer) {
            videoPlayer.pause();
        }
        iframePlayerEl.style.display = 'block';
        iframePlayerEl.src = embedLink;
        saveWatchProgress(currentMovieSlug, embedLink, serverIndex, episodeIndex);
    }
    else {
        iframePlayerEl.style.display = 'none';
        iframePlayerEl.src = '';
        videoJsPlayerEl.style.display = 'block';

        if (!videoPlayer) {
            videoPlayer = videojs('my-video-player', {
                autoplay: true,
                controls: true,
                responsive: true,
                fluid: true,
                playbackRates: [0.5, 1, 1.5, 2]
            });
            videoPlayer.on('ended', handleVideoEnded);
            setupMobileFullscreen(videoPlayer);
        }

        videoPlayer.src({
            src: m3u8Link,
            type: 'application/x-mpegURL'
        });
        videoPlayer.play();
        saveWatchProgress(currentMovieSlug, m3u8Link, serverIndex, episodeIndex);
    }

    updateWatchHistory();
}

function handleVideoEnded() {
    if (isAutoNextEnabled) {
        playNextEpisode();
    }
}

function playNextEpisode() {
    const selectItemsContainer = document.getElementById('select-items');
    const currentSelected = selectItemsContainer.querySelector('.same-as-selected');
    if (!currentSelected) return;

    let nextEpisode = currentSelected.nextElementSibling;

    if (nextEpisode && nextEpisode.tagName === 'DIV') {
        nextEpisode.click();
    }
}

function updateWatchHistory() {
    if (!currentMovieData) return;

    let history = JSON.parse(localStorage.getItem('watchHistoryList') || '[]');
    const config = getCurrentApiConfig();

    history = history.filter(item => item.slug !== currentMovieData.slug);

    const historyItem = {
        slug: currentMovieData.slug,
        name: currentMovieData.name,
        origin_name: currentMovieData.origin_name || '',
        thumb_url: currentMovieData.thumb_url || currentMovieData.poster_url,
        episode_current: document.getElementById('select-selected').textContent,
        source: {
            id: config.id,
            name: config.name,
            number: Object.keys(API_SOURCES).indexOf(config.id) + 1
        }
    };

    history.unshift(historyItem);
    history = history.slice(0, 20);
    localStorage.setItem('watchHistoryList', JSON.stringify(history));
}


function saveWatchProgress(movieSlug, episodeLink, serverIndex, episodeIndex) {
    if (!movieSlug) return;
    try {
        let watchProgress = JSON.parse(localStorage.getItem('watchProgress') || '{}');
        watchProgress[movieSlug] = {
            episodeLink: episodeLink,
            serverIndex: serverIndex,
            episodeIndex: episodeIndex
        };
        localStorage.setItem('watchProgress', JSON.stringify(watchProgress));
    } catch (e) {
        console.error("Lỗi khi lưu tiến trình xem phim:", e);
    }
}

function getWatchProgress(movieSlug) {
    if (!movieSlug) return null;
    try {
        const watchProgress = JSON.parse(localStorage.getItem('watchProgress') || '{}');
        return watchProgress[movieSlug] || null;
    } catch (e) {
        console.error("Lỗi khi lấy tiến trình xem phim:", e);
        return null;
    }
}

function searchMoviesOnWatchPage() {
    const query = document.getElementById("search-input").value.trim();
    if (!query) return;
    window.location.href = `index.html?search_query=${encodeURIComponent(query)}`;
}

function attachCarouselEventsForRelated() {
    const section = document.querySelector('#related-movies-section');
    if (!section) return;
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
    prevBtn.addEventListener('click', () => carousel.scrollBy({ left: -carousel.clientWidth * 0.8, behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => carousel.scrollBy({ left: carousel.clientWidth * 0.8, behavior: 'smooth' }));
    carousel.addEventListener('scroll', updateNavButtons, { passive: true });
    new ResizeObserver(updateNavButtons).observe(carousel);
    updateNavButtons();
}

function setupMobileFullscreen(player) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    player.on('enterfullscreen', () => {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock('landscape').catch(err => console.log("Không thể khóa xoay màn hình:", err));
        }
    });

    player.on('exitfullscreen', () => {
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
            screen.orientation.unlock();
        }
    });
}