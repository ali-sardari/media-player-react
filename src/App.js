import React, {useCallback, useEffect, useRef, useState} from "react";
import SubtitlesParser from "subtitles-parser";
import Modal from "react-modal";
import {ReactComponent as MutedIcon} from "./icons/muted.svg";
import {ReactComponent as UnMutedIcon} from "./icons/unmuted.svg";
import {ReactComponent as StopIcon} from "./icons/stop.svg";
import {ReactComponent as PlayIcon} from "./icons/play.svg";
import {ReactComponent as FullScreenIcon} from "./icons/fullscreen.svg";
import {ReactComponent as SubtitleListIcon} from "./icons/subtitle_list.svg";
import {ReactComponent as SubtitleIcon} from "./icons/subtitle.svg";
import {ReactComponent as SettingsIcon} from "./icons/settings.svg";
import {ReactComponent as UploadIcon} from "./icons/upload.svg";

let isActiveProgress = false;
let lastVolume = 0;
let activeSubtitleId = 0;
const repeatCountReset = 1;
let repeatCount = repeatCountReset;
let repeat_StartTime = 0;
let repeat_EndTime = 0;

const App = () => {
    const videoRef = useRef(null);
    const listItemToFocusRef = useRef();
    const listRef = useRef();
    const subtitlePlayEndTimeRef = useRef(null);

    const [subtitleFirstData, setSubtitleFirstData] = useState([]);
    const [subtitleSecondData, setSubtitleSecondData] = useState([]);
    const [durationTime, setDurationTime] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState(0);
    const [isMouseMoving, setIsMouseMoving] = useState(true);
    const [isShowHideSubtitles, setIsShowHideSubtitles] = useState(true);
    const [isShowHideSettings, setIsShowHideSettings] = useState(false);
    const [isShowHideSubtitleList, setIsShowHideSubtitleList] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);
    const [subtitleSearch, setSubtitleSearch] = useState("");

    const focusOnListItem = useCallback(() => {
        if (
            !isScrolling &&
            listItemToFocusRef.current &&
            !isInViewport(listItemToFocusRef.current) &&
            isShowHideSubtitleList
        ) {
            listItemToFocusRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [isScrolling, isShowHideSubtitleList]); // Empty dependency array if focusOnListItem doesn't depend on external variables

    //region Modal (openModal, openModal)
    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };
    //endregion

    //region Handlers (handleVideoChange, handleSubtitleFirstChange, handleSubtitleSecondChange)
    const handleChooseMedia = (e) => {
        if (e.target.files.length > 0) {
            const videoFile = e.target.files[0];
            videoRef.current.src = URL.createObjectURL(videoFile);
            videoRef.current.load();

            setIsMuted(videoRef.current.muted);
            setProgress(0);
        }
    };

    const handleChooseSubtitle_First = (e) => {
        chooseSubtitle(e, "first");
    };

    const handleChooseSubtitle_Second = (e) => {
        chooseSubtitle(e, "second");
    };

    function chooseSubtitle(e, type) {
        if (e.target.files.length > 0) {
            const reader = new FileReader();

            reader.onload = (e) => {
                const subtitle = SubtitlesParser.fromSrt(e.target.result, false);

                if (type === "first") setSubtitleFirstData(subtitle);
                else setSubtitleSecondData(subtitle);
            };

            reader.readAsText(e.target.files[0]);
        }
    }

    //endregion

    //region Video Element (handleVideoTimeUpdate, handleVideoLoadedMetadata)
    const handleVideoTimeUpdate = () => {
        const video = videoRef.current;
        const videoCurrentTime = video.currentTime;

        setCurrentTime(videoCurrentTime);

        if (!isActiveProgress) {
            if (durationTime !== 0) {
                setProgress(videoCurrentTime / durationTime);
            }
        }

        if (videoCurrentTime === durationTime && durationTime !== 0) {
            setIsPlaying(false);
        }

        if (
            subtitlePlayEndTimeRef.current !== null &&
            videoCurrentTime >= subtitlePlayEndTimeRef.current
        ) {
            video.pause();
            setIsPlaying(false);
            subtitlePlayEndTimeRef.current = null;
            return;
        }

        if (repeat_StartTime !== repeat_EndTime) {
            if (videoCurrentTime >= repeat_EndTime) {
                video.currentTime = repeat_StartTime;
                repeatCount -= 1;
            }

            if (repeatCount === 1) {
                repeat_StartTime = 0;
                repeat_EndTime = 0;
                repeatCount = repeatCountReset;
            }
        }
    };

    function handleVideoLoadedMetadata() {
        setDurationTime(videoRef.current.duration);
        setIsPlaying(true);
    }

    //endregion

    //region Utils (timeToSeconds, formatTime)
    const timeToSeconds = (timeString) => {
        const [hh, mm, ss] = timeString.split(":").map(parseFloat);
        const seconds = hh * 3600 + mm * 60 + ss;

        // Extract milliseconds from the time string
        const milliseconds = parseFloat(timeString.split(",")[1]) / 1000;

        return seconds + milliseconds;
    };

    const formatTime = (timeInSeconds) => {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = Math.floor(timeInSeconds % 60);

        let formattedTime;
        if (hours > 0) {
            formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        } else {
            formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }

        return formattedTime;
    };

    const stripSubtitleTags = (text) => text.replace(/<[^>]*>/g, " ");

    const normalizeSubtitleText = (text) => text.toLowerCase().trim();
    //endregion

    //region Subtitle (renderSubtitleFirst, renderSubtitleSecond)
    const currentFirstSubtitle = findSubtitleByTime(
        subtitleFirstData,
        currentTime,
        "first",
    );
    const currentSecondSubtitle = findSubtitleByTime(
        subtitleSecondData,
        currentTime,
        "second",
    );

    function findSubtitleByTime(subtitles, time, type) {
        const currentSubtitle = subtitles.find(
            (subtitle) =>
                time >= timeToSeconds(subtitle.startTime) &&
                time <= timeToSeconds(subtitle.endTime),
        );

        if (type === "first" && currentSubtitle)
            activeSubtitleId = currentSubtitle.id;

        focusOnListItem();
        return currentSubtitle ? currentSubtitle.text : "";
    }

    //endregion

    const subtitleSearchValue = normalizeSubtitleText(subtitleSearch);
    const filteredSubtitleFirstData = subtitleSearchValue
        ? subtitleFirstData.filter((item) => {
            const searchableSubtitle = normalizeSubtitleText(
                `${stripSubtitleTags(item.text)} ${item.startTime} ${item.endTime}`,
            );

            return searchableSubtitle.includes(subtitleSearchValue);
        })
        : subtitleFirstData;

    //region scroll to active subtitle
    // const handleScroll = () => {
    //     console.log("handleScroll")
    //     setIsScrolling(true);
    //     // Additional logic if needed during scrolling
    // };

    const handleScroll = useCallback((event) => {
        console.log("handleScroll")
        setIsScrolling(true);
    }, []);


    // const handleScrollEnd = () => {
    //     console.log("handleScrollEnd")
    //
    //     setIsScrolling(false);
    //     // Additional logic when scrolling ends
    // };

    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // function focusOnListItem() {
    //     if (
    //         !isScrolling &&
    //         listItemToFocusRef.current &&
    //         !isInViewport(listItemToFocusRef.current) &&
    //         isShowHideSubtitleList
    //     ) {
    //         listItemToFocusRef.current.scrollIntoView({
    //             behavior: "smooth",
    //             block: "center",
    //         });
    //     }
    // }

    // useEffect(() => {
    //     console.log("handleScroll")
    //
    //     // Attach scroll event listeners
    //     window.addEventListener('scroll', handleScroll);
    //     window.addEventListener('scrollend', handleScrollEnd);
    //
    //     // Cleanup event listeners on component unmount
    //     return () => {
    //         window.removeEventListener('scroll', handleScroll);
    //         window.removeEventListener('scrollend', handleScrollEnd);
    //     };
    // }, []);

    // useEffect(() => {
    //     // Attach scroll event listener to the ul element
    //     if (listRef.current) {
    //         listRef.current.addEventListener('scroll', handleScroll);
    //     }
    //
    //     // Cleanup event listener on component unmount
    //     return () => {
    //         if (listRef.current) {
    //             listRef.current.removeEventListener('scroll', handleScroll);
    //         }
    //     };
    // }, []);

    useEffect(() => {
        // Attach scroll event listener to the ul element
        const listRefCurrent = listRef.current;

        if (listRefCurrent) {
            listRefCurrent.addEventListener('scroll', handleScroll);
        }

        // Cleanup event listener on component unmount
        return () => {
            if (listRefCurrent) {
                listRefCurrent.removeEventListener('scroll', handleScroll);
            }
        };
    }, [listRef, handleScroll]);


    useEffect(() => {
        console.log("isScrolling ->", isScrolling);

        focusOnListItem();
    }, [isScrolling, focusOnListItem]);


    // useEffect(() => {
    //     console.log("isScrolling ->", isScrolling);
    //
    //     focusOnListItem();
    // }, [isScrolling]);

    //endregion

    //region Controls (
    // handleClickPlayPause,
    // handleClickMuteToggle,
    // handleChangeVolume,
    // handleChangeProgress,
    // handleToggleFullScreen,
    // handleToggleShowHideSettings,
    // handleToggleShowHideSubtitle,
    // handleToggleShowHideSubtitleList
    // )
    const handleClickPlayPause = () => {
        if (!videoRef.current.currentSrc) {
            alert("Please select a video file first.");
            return;
        }

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }

        setIsPlaying(!isPlaying);
    };

    const handleClickMuteToggle = () => {
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(videoRef.current.muted);

        if (videoRef.current.muted) {
            lastVolume = volume;
            setVolume(0);
        } else {
            setVolume(lastVolume);
        }
    };

    const handleChangeVolume = (e) => {
        if (videoRef.current) {
            const newVolume = parseFloat(e.target.value);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);

            lastVolume = newVolume;

            if (newVolume === 0) {
                videoRef.current.muted = true;
                setIsMuted(true);
            } else {
                videoRef.current.muted = false;
                setIsMuted(false);
            }
        }
    };

    const handleChangeProgress = (e) => {
        isActiveProgress = true;
        subtitlePlayEndTimeRef.current = null;

        if (videoRef.current) {
            const newProgress = parseFloat(e.target.value);
            videoRef.current.currentTime = newProgress * durationTime;
            setProgress(newProgress);
        }

        isActiveProgress = false;
    };

    const handleToggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                // setIsFullscreen(true);
            });
        } else {
            document.exitFullscreen().then(() => {
                // setIsFullscreen(false);
            });
        }
    };

    const handleToggleShowHideSettings = () => {
        setIsShowHideSettings(!isShowHideSettings);
    };

    const handleToggleShowHideSubtitle = () => {
        setIsShowHideSubtitles(!isShowHideSubtitles);
    };

    const handleToggleShowHideSubtitleList = () => {
        setIsShowHideSubtitleList(!isShowHideSubtitleList);
    };

    const handleSwitchToVideoSubtitle = (startTime, endTime) => {
        const subtitleStartTime = timeToSeconds(startTime);
        const subtitleEndTime = timeToSeconds(endTime);

        repeat_StartTime = 0;
        repeat_EndTime = 0;
        repeatCount = repeatCountReset;
        subtitlePlayEndTimeRef.current = subtitleEndTime;

        if (videoRef.current) {
            videoRef.current.currentTime = subtitleStartTime;
            videoRef.current.play();
            setIsPlaying(true);
        }
    };

    //endregion

    useEffect(() => {
        let mouseMoveTimer;

        const handleMouseMove = () => {
            setIsMouseMoving(true);

            // Reset the timer when the mouse moves
            clearTimeout(mouseMoveTimer);

            // Set a timeout to hide 'nex-bottom' after a delay
            mouseMoveTimer = setTimeout(() => {
                setIsMouseMoving(false);
            }, 2000); // Adjust the delay (in milliseconds) as needed
        };

        document.addEventListener("mousemove", handleMouseMove);

        // Clean up the event listener when the component is unmounted
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
        };
    }, [isMouseMoving]);

    //-------------------------------------------------------
    return (
        <>
            <div className="z-player nex-auto-size flex-row">
                <div className="nex-video-player nex-subtitle-show nex-layer-show nex-control-show flex-1">
                    <video
                        className="nex-video"
                        ref={videoRef}
                        autoPlay
                        onDoubleClick={handleToggleFullScreen}
                        onClick={handleClickPlayPause}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onLoadedMetadata={handleVideoLoadedMetadata}
                    ></video>
                    <div
                        data-testid="div-show-hide-subtitle"
                        className={isShowHideSubtitles ? "subtitles" : "none"}
                    >
            <span
                className={`subtitle-en ${subtitleFirstData.length > 0 ? "visible" : "hidden"}`}
                dangerouslySetInnerHTML={{__html: currentFirstSubtitle}}
            ></span>
                        <span
                            className={`subtitle-fa ${subtitleSecondData.length > 0 ? "visible" : "hidden"}`}
                            dangerouslySetInnerHTML={{__html: currentSecondSubtitle}}
                        ></span>
                    </div>
                    <div
                        data-testid="div-controls-video-progress-"
                        className={`nex-bottom ${isMouseMoving || !isPlaying ? "opacity-90" : "opacity-0"}`}
                    >
                        <div data-testid="div-video-progress-bar" className="nex-progress">
                            <div className="nex-control nex-control-progress" data-index="10">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.0001"
                                    value={progress}
                                    onChange={handleChangeProgress}
                                    className="x-progress"
                                />
                            </div>
                        </div>
                        <div data-testid="div-video-controls" className="nex-controls">
                            <div className="nex-controls-left">
                                <div
                                    className="nex-control nex-control-playAndPause"
                                    data-index="10"
                                    onClick={handleClickPlayPause}
                                >
                                    <i
                                        aria-label="Play/Pause"
                                        className="nex-icon nex-icon-play"
                                        data-balloon-pos="up"
                                    >
                                        {isPlaying ? <StopIcon/> : <PlayIcon/>}
                                    </i>
                                </div>
                                <div className="nex-control nex-control-volume" data-index="20">
                                    <i
                                        aria-label="Mute"
                                        className="nex-icon nex-icon-volume"
                                        data-balloon-pos="up"
                                        style={{display: "flex"}}
                                        onClick={handleClickMuteToggle}
                                    >
                                        {isMuted ? <MutedIcon/> : <UnMutedIcon/>}
                                    </i>
                                    <div className="nex-volume-panel">
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={volume}
                                            onChange={handleChangeVolume}
                                            className="nex-volume-slider"
                                        />
                                    </div>
                                </div>
                                <div
                                    className="nex-control nex-control-time nex-control-onlyText"
                                    data-index="30"
                                >
                                    {formatTime(currentTime)} / {formatTime(durationTime)}
                                </div>
                            </div>
                            <div className="nex-controls-right">
                                <div
                                    aria-label="Upload files"
                                    className="nex-control nex-control-subtitle"
                                    data-balloon-pos="up"
                                    data-index="30"
                                    onClick={openModal}
                                >
                                    <i className="nex-icon nex-icon-subtitle">
                                        <UploadIcon/>
                                    </i>
                                </div>
                                <div
                                    aria-label={
                                        isShowHideSubtitles ? "Hide subtitle" : "Show subtitle"
                                    }
                                    className="nex-control nex-control-subtitle"
                                    data-balloon-pos="up"
                                    data-index="30"
                                    onClick={handleToggleShowHideSubtitle}
                                >
                                    <i className="nex-icon nex-icon-subtitle">
                                        <SubtitleIcon
                                            className={`${isShowHideSubtitles ? "icon-active" : ""}`}
                                        />
                                    </i>
                                </div>
                                <div
                                    aria-label={
                                        isShowHideSubtitleList
                                            ? "Hide the full subtitle"
                                            : "Show the full subtitle"
                                    }
                                    className={`nex-control nex-control-subtitle`}
                                    data-balloon-pos="up"
                                    data-index="30"
                                    onClick={handleToggleShowHideSubtitleList}
                                >
                                    <i className="nex-icon nex-icon-subtitle">
                                        <SubtitleListIcon
                                            className={`${isShowHideSubtitleList ? "icon-active" : ""}`}
                                        />
                                    </i>
                                </div>
                                <div
                                    aria-label="Show setting"
                                    className="nex-control nex-control-setting"
                                    data-balloon-pos="up"
                                    data-index="40"
                                    onClick={handleToggleShowHideSettings}
                                >
                                    <i className="nex-icon nex-icon-setting">
                                        <SettingsIcon/>
                                    </i>
                                </div>
                                <div
                                    aria-label="Fullscreen"
                                    className="nex-control nex-control-fullscreen"
                                    data-balloon-pos="up"
                                    data-index="70"
                                    onClick={handleToggleFullScreen}
                                >
                                    <i className="nex-icon nex-icon-fullscreen">
                                        <FullScreenIcon/>
                                    </i>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        data-testid="div-show-hide-setting"
                        className={`nex-settings ${isShowHideSettings ? "visible" : "invisible"}`}
                        onClick={handleToggleShowHideSettings}
                    >
                        <div
                            className={`nex-setting-inner nex-backdrop-filter ${isShowHideSettings ? "right-0" : "right-[-300px]"}`}
                        >
                            <div className="nex-setting-body">
                                <div className="nex-setting nex-setting-flip" data-index="2">
                                    <div className="nex-setting-header">Flip</div>
                                    <div className="nex-setting-radio">
                                        <div className="nex-radio-item current">
                                            <button data-value="normal" type="button">
                                                Normal
                                            </button>
                                        </div>
                                        <div className="nex-radio-item">
                                            <button data-value="horizontal" type="button">
                                                Horizontal
                                            </button>
                                        </div>
                                        <div className="nex-radio-item">
                                            <button data-value="vertical" type="button">
                                                Vertical
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="nex-setting nex-setting-rotate" data-index="3">
                                    <div className="nex-setting-header">
                                        Rotate: <span className="nex-rotate-value">0°</span>
                                    </div>
                                    <div className="nex-setting-radio">
                                        <div className="nex-radio-item">
                                            <button data-value="90" type="button">
                                                +90°
                                            </button>
                                        </div>
                                        <div className="nex-radio-item">
                                            <button data-value="-90" type="button">
                                                -90°
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="nex-setting nex-setting-aspectRatio"
                                    data-index="4"
                                >
                                    <div className="nex-setting-header">Aspect ratio</div>
                                    <div className="nex-setting-radio">
                                        <div className="nex-radio-item current">
                                            <button data-value="default" type="button">
                                                Default
                                            </button>
                                        </div>
                                        <div className="nex-radio-item">
                                            <button data-value="4:3" type="button">
                                                4:3
                                            </button>
                                        </div>
                                        <div className="nex-radio-item">
                                            <button data-value="16:9" type="button">
                                                16:9
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="nex-setting nex-setting-playbackRate"
                                    data-index="5"
                                >
                                    <div className="nex-setting-header">
                                        Play speed: <span className="nex-subtitle-value">1</span>x
                                    </div>
                                    <div className="nex-setting-range">
                                        <input
                                            className="nex-subtitle-range"
                                            max="2"
                                            min="0.5"
                                            step="0.25"
                                            type="range"
                                            defaultValue="1"
                                        />
                                    </div>
                                </div>
                                <div
                                    className="nex-setting nex-setting-subtitleOffset"
                                    data-index="20"
                                >
                                    <div className="nex-setting-header">
                                        Subtitle offset time:{" "}
                                        <span className="nex-subtitle-value">0</span>s
                                    </div>
                                    <div className="nex-setting-range">
                                        <input
                                            className="nex-subtitle-range"
                                            id="subtitleSync"
                                            max="999"
                                            min="-999"
                                            step="0.5"
                                            type="range"
                                            defaultValue="0"
                                        />
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                marginTop: "8px",
                                            }}
                                        >
                                            <button
                                                className="sync-btn"
                                                data-val="-5"
                                                id="minusfivesec"
                                            >
                                                -5s
                                            </button>
                                            <button
                                                className="sync-btn"
                                                data-val="-0.5"
                                                id="minushalfsec"
                                            >
                                                -0.5s
                                            </button>
                                            <button
                                                className="sync-btn"
                                                data-val="+0.5"
                                                id="plushalfsec"
                                            >
                                                +0.5s
                                            </button>
                                            <button
                                                className="sync-btn"
                                                data-val="+5"
                                                id="plusfivesec"
                                            >
                                                +5s
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="nex-setting nex-setting-localVideo"
                                    data-index="30"
                                >
                                    <div className="nex-setting-header">Local Video</div>
                                    <div className="nex-setting-upload">
                                        <div
                                            className="nex-upload-btn"
                                            style={{position: "relative"}}
                                        >
                                            Open
                                            <input
                                                style={{
                                                    position: "absolute",
                                                    width: "100%",
                                                    height: "100%",
                                                    left: "0px",
                                                    top: "0px",
                                                    opacity: 0,
                                                }}
                                                type="file"
                                            />
                                        </div>
                                        <div className="nex-upload-value"></div>
                                    </div>
                                </div>
                                <div
                                    className="nex-setting nex-setting-localSubtitle"
                                    data-index="40"
                                >
                                    <div className="nex-setting-header">Local Subtitle</div>
                                    <div className="nex-setting-upload">
                                        <div
                                            className="nex-upload-btn"
                                            style={{position: "relative"}}
                                        >
                                            Open
                                            <input
                                                style={{
                                                    position: "absolute",
                                                    width: "100%",
                                                    height: "100%",
                                                    left: "0px",
                                                    top: "0px",
                                                    opacity: 0,
                                                }}
                                                type="file"
                                            />
                                        </div>
                                        <div className="nex-upload-value"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    className={`subtitle-sidebar ${isShowHideSubtitleList ? "subtitle-sidebar-visible" : ""} w-[-350px]`}
                    data-testid="div-show-hide-subtitle-list"
                >
                    <div className={`subtitle-sidebar-inner`} ref={listRef}>
                        <div className="subtitle-search">
                            <input
                                type="search"
                                value={subtitleSearch}
                                onChange={(event) => setSubtitleSearch(event.target.value)}
                                placeholder="Search subtitle..."
                                aria-label="Search subtitle"
                                dir="auto"
                            />
                        </div>
                        <ul>
                            {filteredSubtitleFirstData.map((item) => (
                                <li key={item.id}>
                                    <div
                                        ref={
                                            activeSubtitleId === item.id ? listItemToFocusRef : null
                                        }
                                        className={`subtitle-item ${activeSubtitleId === item.id ? "subtitle-item-active" : ""} flex-1 p-1 mr-1 ml-1 mt-1`}
                                    >
                                        <div
                                            className="timeBox"
                                            onClick={() =>
                                                handleSwitchToVideoSubtitle(item.startTime, item.endTime)
                                            }
                                        >
                                            <span className="hidden m1 transition-all">▶</span>
                                            <div className="flex-1 text-center">
                                                {item.startTime.split(",")[0]}
                                            </div>
                                        </div>
                                        <div
                                            className="ml-1 flex-1 self-center"
                                            dangerouslySetInnerHTML={{__html: item.text}}
                                        ></div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {filteredSubtitleFirstData.length === 0 && (
                            <div className="subtitle-empty">No subtitle found</div>
                        )}
                    </div>
                </div>
            </div>

            <Modal
                appElement={document.getElementById("root")}
                isOpen={isModalOpen}
                onRequestClose={closeModal}
                style={{
                    content: {
                        maxWidth: "400px", // Set the maximum width of the modal content
                        margin: "auto", // Center the modal horizontally
                        border: "1px solid #ccc",
                        borderRadius: "5px",
                        background: "rgba(65,65,65,0.8)",
                        boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
                        color: "#f4f4f4",
                        direction: "ltr",
                    },
                    overlay: {
                        zIndex: 1000, // Set the overlay z-index to a high value
                        backgroundColor: "rgba(0, 0, 0, 0.5)", // Set the overlay background color and transparency
                    },
                }}
            >
                <h2 className="text-2xl font-bold mb-4">Upload</h2>
                <label className="mt-4 inline-block">
                    Choose Video:
                    <input
                        type="file"
                        accept=".flv, .mp4, .mkv, .mp3"
                        onChange={handleChooseMedia}
                    />
                </label>
                <label className="mt-4 inline-block">
                    Choose First Subtitle:
                    <input
                        type="file"
                        accept=".srt"
                        onChange={handleChooseSubtitle_First}
                    />
                </label>
                <label className="mt-4 inline-block">
                    Choose Second Subtitle:
                    <input
                        type="file"
                        accept=".srt"
                        onChange={handleChooseSubtitle_Second}
                    />
                </label>
                <button
                    className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={closeModal}
                >
                    Apply
                </button>
            </Modal>
        </>
    );
};

export default App;
