// watch.js

// --- 1. BIẾN TOÀN CỤC CHO TRANG XEM PHIM ---
let isAutoNextEnabled = true;
let currentEpisodeList = [];
let fullEpisodeData = [];
let currentMovieSlug = '';
let videoPlayer = null;
let currentMovieData = null;
let relatedMoviesData = [];

// --- 2. HÀM DÀNH RIÊNG CHO TRANG XEM PHIM ---

/** Tải toàn bộ thông tin cho trang xem phim */
async function loadWatchPage(slug) {
    currentMovieSlug = slug;
    const config = getCurrentApiConfig();
    showSpinner(); // Hiện spinner trước khi bắt đầu tải
    try {
        const data = await getMovieDetails(slug); // Dùng hàm từ shared.js
        if (!data) throw new Error("Không lấy được chi tiết phim.");
        
        // Fetch lại để lấy danh sách tập phim đầy đủ
        const res = await fetch(`${config.base}${config.paths.details(slug)}`);
        const fullData = await res.json();
        
        currentMovieData = data;
        fullEpisodeData = config.dataAccess.episodes(fullData);

        document.title = currentMovieData.name;
        document.getElementById('movie-title').textContent = currentMovieData.name;
        document.getElementById('movie-meta-info').innerHTML = `
            <span class="meta-item"><strong>Năm:</strong> ${currentMovieData.year || 'N/A'}</span>
            <span class="meta-item"><strong>Quốc gia:</strong> ${currentMovieData.country?.map(c => c.name).join(', ') || 'N/A'}</span>
            <span class="meta-item"><strong>Thể loại:</strong> ${currentMovieData.category?.map(c => c.name).join(', ') || 'N/A'}</span>
        `;
        document.getElementById('movie-description-content').innerHTML = currentMovieData.content || 'Chưa có mô tả.';
        
        renderServerButtons();
        
        const savedProgress = getWatchProgress(currentMovieSlug);
        let serverToSelect = document.querySelector(`.server-btn[data-server-index="${savedProgress?.serverIndex || 0}"]`);
        if (!serverToSelect) serverToSelect = document.querySelector('.server-btn');
        
        if (serverToSelect) {
            serverToSelect.click();
        } else {
            updateEpisodeList(0);
        }
        
        loadRelatedMovies();

    } catch (error) {
        console.error("Lỗi khi tải trang xem phim:", error);
        document.getElementById('movie-title').textContent = "Lỗi khi tải thông tin phim.";
    } finally {
        hideSpinner(); // Luôn ẩn spinner sau khi tải xong (kể cả khi lỗi)
    }
}

/** Hiển thị các nút chọn server */
function renderServerButtons() {
    const serverSelectionDiv = document.getElementById('server-selection');
    const serverListDiv = document.getElementById('server-list');
    serverListDiv.innerHTML = '';

    if (fullEpisodeData && fullEpisodeData.length > 1) {
        serverSelectionDiv.style.display = 'flex';
        fullEpisodeData.forEach((server, index) => {
            const button = document.createElement('button');
            button.className = 'server-btn';
            button.textContent = server.server_name;
            button.dataset.serverIndex = index;

            button.onclick = function() {
                // Kích hoạt lại tất cả các nút trước
                document.querySelectorAll('.server-btn').forEach(btn => {
                    btn.classList.remove('active');
                    btn.disabled = false;
                });
                
                // Vô hiệu hóa nút vừa được click
                this.classList.add('active');
                this.disabled = true;
                
                updateEpisodeList(index);
            };
            serverListDiv.appendChild(button);
        });
    } else {
        serverSelectionDiv.style.display = 'none';
    }
}


/** Cập nhật danh sách tập khi đổi server */
// Thay thế toàn bộ hàm updateEpisodeList trong watch.js bằng mã này:
function updateEpisodeList(serverIndex) {
    const serverData = fullEpisodeData ? fullEpisodeData[serverIndex] : null;
    currentEpisodeList = (serverData?.items || serverData?.server_data) ?? [];

    const selectSelected = document.getElementById('select-selected');
    const selectItems = document.getElementById('select-items');
    selectItems.innerHTML = '';

    const hasMultipleEpisodes = currentEpisodeList.length > 1;
    document.getElementById('episode-nav-buttons').style.display = hasMultipleEpisodes ? 'flex' : 'none';
    document.getElementById('auto-next-wrapper').style.display = hasMultipleEpisodes && getCurrentApiConfig().id !== 'nguonc' ? 'flex' : 'none';

    if (currentEpisodeList.length > 0) {
        currentEpisodeList.forEach((ep, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.textContent = ep.name;
            optionDiv.dataset.m3u8 = ep.m3u8 || ep.link_m3u8;
            
            // === SỬA LỖI TẠI ĐÂY ===
            // Tìm link embed ở nhiều thuộc tính có thể có (embed, link_embed)
            optionDiv.dataset.embed = ep.embed || ep.link_embed;
            // ========================

            optionDiv.dataset.episodeIndex = index;

            optionDiv.addEventListener('click', function() {
                playEpisode(this.dataset.m3u8, this.dataset.embed, serverIndex, index, ep.name);
                
                selectSelected.textContent = this.textContent;
                
                selectItems.querySelectorAll('div').forEach(item => {
                    item.classList.remove('same-as-selected', 'disabled-episode');
                });
                
                this.classList.add('same-as-selected', 'disabled-episode');
                
                selectItems.classList.add('select-hide');
            });
            selectItems.appendChild(optionDiv);
        });
        
        const lastWatchedProgress = getWatchProgress(currentMovieSlug);
        let episodeToPlay;
        if (lastWatchedProgress?.serverIndex === serverIndex && lastWatchedProgress.lastEpisodeIndex !== undefined) {
            episodeToPlay = selectItems.querySelector(`div[data-episode-index="${lastWatchedProgress.lastEpisodeIndex}"]`);
        }
        
        if (!episodeToPlay) episodeToPlay = selectItems.querySelector('div');
        if (episodeToPlay) setTimeout(() => episodeToPlay.click(), 100);

    } else {
        selectSelected.textContent = 'Chưa có tập';
        document.getElementById('episode-info').textContent = '';
        document.getElementById('prev-episode-btn').disabled = true;
        document.getElementById('next-episode-btn').disabled = true;
        document.getElementById('video-player-container').style.display = 'none';
    }
}

/** Phát một tập phim */
function playEpisode(m3u8Link, embedLink, serverIndex, episodeIndex, episodeName) {
    if ((!m3u8Link || m3u8Link === 'undefined') && (!embedLink || embedLink === 'undefined')) {
        showCustomAlert("Tập phim này hiện không có nguồn phát.", 2000);
        return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const playerContainer = document.getElementById('video-player-container');
    playerContainer.style.display = 'block';
    
    const videoJsPlayerEl = document.getElementById('my-video-player');
    const iframePlayerEl = document.getElementById('iframe-player');

    if (getCurrentApiConfig().id === 'nguonc' && embedLink) {
        videoJsPlayerEl.style.display = 'none';
        if (videoPlayer) videoPlayer.pause();
        iframePlayerEl.style.display = 'block';
        iframePlayerEl.src = embedLink;
    } else {
        iframePlayerEl.style.display = 'none';
        iframePlayerEl.src = '';
        videoJsPlayerEl.style.display = 'block';

        if (!videoPlayer) {
            videoPlayer = videojs('my-video-player', {
                autoplay: true, controls: true, responsive: true, fluid: true,
                playbackRates: [0.5, 1, 1.5, 2],
                pictureInPictureToggle: true,
                
            });

            videoPlayer.on('ended', handleVideoEnded);
            
            // SỬA LỖI 1: Cập nhật sự kiện timeupdate để lưu đúng tiến trình
           videoPlayer.on('timeupdate', () => {
                const currentTime = videoPlayer.currentTime();
                const duration = videoPlayer.duration();
                const nextEpisodeOverlay = document.getElementById('next-episode-overlay');
                
                // 1. Lưu tiến trình xem phim
                const currentServerIndex = videoPlayer.currentServerIndex;
                const currentEpisodeIndex = videoPlayer.currentEpisodeIndex;
                if (typeof currentEpisodeIndex !== 'undefined') {
                    saveWatchProgress(currentMovieSlug, null, currentServerIndex, currentEpisodeIndex, currentTime);
                }

                // 2. Hiển thị nút "Tập tiếp theo" khi còn 60 giây cuối
                if (duration && nextEpisodeOverlay) {
                    const timeLeft = duration - currentTime;
                    // Kiểm tra xem có tập tiếp theo không
                    const nextBtn = document.getElementById('next-episode-btn');
                    const hasNextEpisode = nextBtn && !nextBtn.disabled;

                    if (timeLeft <= 60 && hasNextEpisode) {
                        nextEpisodeOverlay.classList.add('visible');
                    } else {
                        nextEpisodeOverlay.classList.remove('visible');
                    }
                }
            });

            // SỬA LỖI 2: Cập nhật sự kiện loadedmetadata để phát lại đúng mốc thời gian
            videoPlayer.on('loadedmetadata', () => { // Thay .one bằng .on
                // Luôn lấy index mới nhất được lưu trên player
                const currentEpisodeIndex = videoPlayer.currentEpisodeIndex;
                if (typeof currentEpisodeIndex !== 'undefined') {
                    const progress = getWatchProgress(currentMovieSlug);
                    const savedTime = progress?.episodes?.[currentEpisodeIndex]?.time;
                    // Nếu có thời gian đã lưu > 5 giây thì tua đến
                    if (savedTime && savedTime > 5) {
                        videoPlayer.currentTime(savedTime);
                    }
                }
            });
        }

        // === THAY ĐỔI QUAN TRỌNG NHẤT ===
        // Lưu index của tập và server hiện tại vào chính đối tượng player
        // mỗi khi một tập mới được chọn.
        videoPlayer.currentServerIndex = serverIndex;
        videoPlayer.currentEpisodeIndex = episodeIndex;
        // ================================

        videoPlayer.src({ src: m3u8Link, type: 'application/x-mpegURL' });
        videoPlayer.play();
    }
    
    saveWatchProgress(currentMovieSlug, null, serverIndex, episodeIndex);
    updateWatchHistory(episodeName);
    updateNavButtonStates(episodeIndex);
    document.getElementById('episode-info').textContent = `Bạn đang xem: ${episodeName}`;
}
function handleVideoEnded() {
    if (isAutoNextEnabled) playNextEpisode();
}

function playNextEpisode() {
    document.getElementById('next-episode-btn').click();
}

function playPreviousEpisode() {
    document.getElementById('prev-episode-btn').click();
}

function updateNavButtonStates(currentIndex) {
    const prevBtn = document.getElementById('prev-episode-btn');
    const nextBtn = document.getElementById('next-episode-btn');
    
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= currentEpisodeList.length - 1;

    prevBtn.onclick = () => {
        if(currentIndex > 0) document.querySelector(`#select-items div[data-episode-index="${currentIndex - 1}"]`)?.click();
    };
    nextBtn.onclick = () => {
        if(currentIndex < currentEpisodeList.length - 1) document.querySelector(`#select-items div[data-episode-index="${currentIndex + 1}"]`)?.click();
    };
}


/** Tải danh sách phim liên quan */
async function loadRelatedMovies() {
    const relatedSection = document.getElementById('related-movies-section');
    const carousel = document.getElementById('related-movies-carousel');
    if (!relatedSection || !carousel) return;
    
    const config = getCurrentApiConfig();
    try {
        const res = await fetch(`${config.base}${config.paths.related()}`);
        const data = await res.json();
        relatedMoviesData = config.dataAccess.relatedItems(data) || [];
        
        if (relatedMoviesData.length > 0) {
            carousel.innerHTML = '';
            relatedMoviesData.forEach(movie => carousel.appendChild(createMovieCard(movie)));
            relatedSection.style.display = 'block';
            attachCarouselEventsForRelated();
        } else {
            relatedSection.style.display = 'none';
        }
    } catch (error) {
        console.error("Lỗi tải phim liên quan:", error);
        relatedSection.style.display = 'none';
    }
}

/** Gắn sự kiện cho carousel phim liên quan */
function attachCarouselEventsForRelated() {
    const section = document.querySelector('#related-movies-section');
    if (!section) return;
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

/** Cập nhật lịch sử xem phim */
function updateWatchHistory(episodeName) { // Thêm episodeName
    if (!currentMovieData || !episodeName) return;
    let history = JSON.parse(localStorage.getItem('watchHistoryList') || '[]');
    history = history.filter(item => item.slug !== currentMovieData.slug);
    
    const config = getCurrentApiConfig();
    const historyItem = {
        slug: currentMovieData.slug,
        name: currentMovieData.name,
        thumb_url: currentMovieData.thumb_url || currentMovieData.poster_url,
        episode_current: episodeName, // Sử dụng episodeName thay vì đọc từ DOM
        year: currentMovieData.year,
        country: currentMovieData.country,
        lang: currentMovieData.lang,
        source: {
            id: config.id,
            name: config.name,
            number: Object.keys(API_SOURCES).indexOf(config.id) + 1
        }
    };
    
    history.unshift(historyItem);
    localStorage.setItem('watchHistoryList', JSON.stringify(history.slice(0, 20)));
}

/** Lưu tiến trình xem phim */
function saveWatchProgress(slug, episodeLink, serverIndex, episodeIndex, currentTime = 0) {
    if (!slug) return;
    try {
        let progress = JSON.parse(localStorage.getItem('watchProgress') || '{}');
        if (!progress[slug]) progress[slug] = { episodes: {} };
        progress[slug].serverIndex = serverIndex;
        progress[slug].lastEpisodeIndex = episodeIndex;
        if (currentTime > 5) {
             if (!progress[slug].episodes) progress[slug].episodes = {};
            progress[slug].episodes[episodeIndex] = { time: currentTime };
        }
        localStorage.setItem('watchProgress', JSON.stringify(progress));
    } catch (e) { console.error("Lỗi lưu tiến trình:", e); }
}

/** Lấy tiến trình xem phim */
function getWatchProgress(slug) {
    if (!slug) return null;
    try {
        const progress = JSON.parse(localStorage.getItem('watchProgress') || '{}');
        return progress[slug] || null;
    } catch (e) {
        console.error("Lỗi lấy tiến trình:", e);
        return null;
    }
}

/** Xử lý tìm kiếm (chuyển hướng về trang chủ) */
function handleSearchOnWatchPage(query) {
    if (query) window.location.href = `index.html?search_query=${encodeURIComponent(query)}`;
}

// --- 3. KHỞI CHẠY ---
// Thay thế khối DOMContentLoaded trong watch.js bằng mã này:
document.addEventListener('DOMContentLoaded', () => {
    // Hàm xử lý tìm kiếm mới: Luôn điều hướng đến trang search.html
    const universalSearchHandler = (query) => {
        if (query) {
            window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
    };
    initializeSharedUI(universalSearchHandler);
      document.addEventListener('keydown', (event) => {
        // Bỏ qua nếu người dùng đang gõ vào ô tìm kiếm
        if (event.target.tagName === 'INPUT') {
            return;
        }

        // Chỉ hoạt động khi trình phát video.js tồn tại và đang hiển thị
        if (videoPlayer && !videoPlayer.el().style.display.includes('none')) {
            switch (event.code) {
                case 'Space':
                    // Ngăn trình duyệt cuộn trang khi nhấn phím cách
                    event.preventDefault();
                    if (videoPlayer.paused()) {
                        videoPlayer.play();
                    } else {
                        videoPlayer.pause();
                    }
                    break;
                
                case 'KeyF':
                    // Bật/tắt toàn màn hình
                    event.preventDefault();
                    if (videoPlayer.isFullscreen()) {
                        videoPlayer.exitFullscreen();
                    } else {
                        videoPlayer.requestFullscreen();
                    }
                    break;
            }
        }
    });
    // Tạo sẵn iframe player
    const playerWrapper = document.getElementById('video-player-container');
    if (playerWrapper) {
        const iframePlayer = document.createElement('iframe');
        iframePlayer.id = 'iframe-player';
        iframePlayer.style.cssText = 'display: none; width: 100%; border: 0; aspect-ratio: 16 / 9;';
        iframePlayer.setAttribute('allowfullscreen', '');
        playerWrapper.appendChild(iframePlayer);
    }
    
    // Xử lý nút tự động chuyển tập
    const autoNextBtn = document.getElementById('auto-next-btn');
    if (autoNextBtn) {
        isAutoNextEnabled = localStorage.getItem('isAutoNextEnabled') !== 'false';
        const updateBtnState = () => {
             autoNextBtn.classList.toggle('active', isAutoNextEnabled);
             autoNextBtn.querySelector('i').className = `fas fa-toggle-${isAutoNextEnabled ? 'on' : 'off'}`;
        };
        updateBtnState();
        autoNextBtn.addEventListener('click', () => {
            isAutoNextEnabled = !isAutoNextEnabled;
            localStorage.setItem('isAutoNextEnabled', isAutoNextEnabled);
            updateBtnState();
        });
    }
    if (playerWrapper) { // Chúng ta vẫn có thể dùng biến playerWrapper ở đây
        const nextEpisodeOverlay = document.createElement('button');
        nextEpisodeOverlay.id = 'next-episode-overlay';
        nextEpisodeOverlay.innerHTML = '<i class="fas fa-step-forward"></i> Tập tiếp theo';
        
        nextEpisodeOverlay.addEventListener('click', () => {
            playNextEpisode(); 
        });
        
        playerWrapper.appendChild(nextEpisodeOverlay);
    }
    // Xử lý custom select cho danh sách tập
    const selectSelected = document.getElementById('select-selected');
    const selectItems = document.getElementById('select-items');
    if(selectSelected && selectItems) {
        selectSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItems.classList.toggle('select-hide');
        });
        document.addEventListener("click", () => selectItems.classList.add('select-hide'));
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const movieSlug = urlParams.get('slug');
    if (movieSlug) {
        loadWatchPage(movieSlug);
    } else {
        document.getElementById('movie-title').textContent = "Không tìm thấy phim!";
    }
});