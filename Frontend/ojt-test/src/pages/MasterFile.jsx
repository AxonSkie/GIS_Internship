import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../services/api";
import L from "leaflet";
import {
  Ellipsis,
  MapPin,
  X,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";



import {
  MapContainer,
  Marker,
  Pane,
  TileLayer,
  GeoJSON,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const gpsMarkerIcon = L.divIcon({
  className: "",
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44" aria-hidden="true">
      <path d="M18 1C8.6 1 1 8.6 1 18c0 12.2 17 25 17 25s17-12.8 17-25C35 8.6 27.4 1 18 1Z" fill="#dc2626" stroke="#fff" stroke-width="2"/>
      <circle cx="18" cy="18" r="6" fill="#fff"/>
    </svg>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
});



const columns = [
  { key: "file_id", label: "File ID" },
  { key: "file_name", label: "File Name" },
  { key: "file_path", label: "File Path" },
  { key: "layer_name", label: "Layer Name" },
  { key: "geometry_type", label: "Geometry Type" },
  { key: "data_format", label: "Data Format" },
  { key: "file_size", label: "File Size" },
  { key: "spatial_reference", label: "Spatial Reference" },
  { key: "extent", label: "Extent" },
  { key: "creation_date", label: "Creation Date" },
  { key: "data_source", label: "Data Source" },
  { key: "processing", label: "Processing" },
  { key: "accuracy", label: "Accuracy" },
  { key: "version", label: "Version" },
  { key: "responsible_person", label: "Responsible Person" },
  { key: "description", label: "Description" },
  { key: "remarks", label: "Remarks" },
  { key: "keywords", label: "Keywords" },
  { key: "data_privacy", label: "Data Privacy" },
  { key: "data_sharing_agreement_with", label: "Data Sharing Agreement With" },
  
];




const rawDataColumns = [
  { key: "raw_data_id", label: "ID" },
  { key: "main_folder", label: "Main Folder" },
  { key: "folder_name", label: "Folder Name" },
  { key: "full_path", label: "Full Path" },
  { key: "pscg", label: "PSCG" },
  { key: "model_unit", label: "Model Unit" },
  { key: "gsd", label: "GSD" },
  { key: "uav_mission_id", label: "UAV Mission ID" },
  { key: "file_size", label: "File Size" },
  { key: "creation_date", label: "Creation Date" },
  { key: "data_source", label: "Data Source" },
  { key: "description", label: "Description" },
  { key: "data_privacy", label: "Data Privacy" },
];

const processedDataColumns = [
  { key: "Main Folder", label: "Main Folder" },
  { key: "Folder Name", label: "Folder Name" },
  { key: "Full path", label: "Full Path" },
  { key: "PSCG", label: "PSCG" },
  { key: "File Size", label: "File Size (bytes)" },
  { key: "UAV Mission ID", label: "UAV Mission ID" },
  { key: "Creation date", label: "Creation Date" },
  { key: "Data source", label: "Data Source" },
  { key: "Description", label: "Description" },
  { key: "Data Privacy", label: "Data Privacy" },
];

function formatValue(key, value) {
  if (value == null || value === "") {
    return "";
  }

  if (key === "creation_date" && typeof value === "string") {
    return value.replace(/(?:Z|[+-]\d{2}:?\d{2})$/i, "").replace("T", " ");
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function getFolderFileUrl(path) {
  const normalizedPath = path.replace(/\\/g, "/");
  const isUncPath = normalizedPath.startsWith("//");
  const segments = normalizedPath.split("/").filter(Boolean);

  if (
    !isUncPath &&
    !normalizedPath.startsWith("/") &&
    !/^[A-Za-z]:/.test(normalizedPath)
  ) {
    return null;
  }

  const encodedSegments = segments.map((segment, index) =>
    index === 0 && /^[A-Za-z]:$/.test(segment)
      ? segment
      : encodeURIComponent(segment)
  );

  return isUncPath
    ? `file://${encodedSegments.join("/")}`
    : `file:///${encodedSegments.join("/")}`;
}

const municipalityPSGC = {
  "1830200000": "Bacolod City",
  "1804502000": "City of Bago",
  "1804503000": "Binalbagan",
  "1804504000": "City of Cadiz",
  "1804505000": "Calatrava",
  "1804506000": "Candoni",
  "1804507000": "Cauayan",
  "1804508000": "Enrique B. Magalona",
  "1804509000": "City of Escalante",
  "1804510000": "City of Himamaylan",
  "1804511000": "Hinigaran",
  "1804512000": "Hinoba-an",
  "1804513000": "Ilog",
  "1804514000": "Isabela",
  "1804515000": "City of Kabankalan",
  "1804516000": "City of La Carlota",
  "1804517000": "La Castellana",
  "1804518000": "Manapla",
  "1804519000": "Moises Padilla",
  "1804520000": "Murcia",
  "1804521000": "Pontevedra",
  "1804522000": "Pulupandan",
  "1804523000": "City of Sagay",
  "1804524000": "City of San Carlos",
  "1804525000": "San Enrique",
  "1804526000": "City of Silay",
  "1804527000": "City of Sipalay",
  "1804528000": "City of Talisay",
  "1804529000": "Toboso",
  "1804530000": "Valladolid",
  "1804531000": "City of Victorias",
  "1804532000": "Salvador Benedicto",
};

function normalizeMunicipalityName(name) {
  if (!name) {
    return "";
  }

  return name
    .replace(/^City of /, "")
    .replace(/ City$/, "")
    .trim()
    .toLowerCase();
}

function normalizePSGCCode(pscg) {
  const code = String(pscg ?? "").trim().replace(/\.0+$/, "");

  return /^\d+$/.test(code) && code.length < 10
    ? code.padStart(10, "0")
    : code;
}

function getMunicipalityFromFilename(fileName) {
  if (!fileName) {
    return null;
  }

  const psgc = fileName.substring(0, 10);

  if (municipalityPSGC[psgc]) {
    return municipalityPSGC[psgc];
  }

  const parentPSGC = psgc.substring(0, 7) + "000";

  return municipalityPSGC[parentPSGC] || null;
}

function getMunicipalityFromPSGC(pscg) {
  const code = String(pscg ?? "").trim();

  if (!code) {
    return null;
  }

  if (municipalityPSGC[code]) {
    return municipalityPSGC[code];
  }

  const parentPSGC = code.substring(0, 7) + "000";

  return municipalityPSGC[parentPSGC] || null;
}

function getMunicipalityCodeFromPSGC(psgc) {
  const code = String(psgc ?? "").trim();

  if (municipalityPSGC[code]) {
    return code;
  }

  const parentPSGC = code.substring(0, 7) + "000";

  return municipalityPSGC[parentPSGC] ? parentPSGC : null;
}

function getMunicipalityCodeFromName(name) {
  const normalizedName = normalizeMunicipalityName(name);
  const municipality = Object.entries(municipalityPSGC).find(
    ([, municipalityName]) =>
      normalizeMunicipalityName(municipalityName) === normalizedName
  );

  return municipality?.[0] ?? null;
}

function getLocationCounts(records, getPSGC) {
  const municipalityCounts = new Map();
  const barangayCounts = new Map();

  records.forEach((record) => {
    const psgc = String(getPSGC(record) ?? "").trim();
    const municipalityCode = getMunicipalityCodeFromPSGC(psgc);

    if (!municipalityCode) {
      return;
    }

    municipalityCounts.set(
      municipalityCode,
      (municipalityCounts.get(municipalityCode) ?? 0) + 1
    );
    barangayCounts.set(psgc, (barangayCounts.get(psgc) ?? 0) + 1);
  });

  return { municipalityCounts, barangayCounts };
}




function DataTabs({ activeTab, onTabChange }) {
  return (
    <nav
      className="mb-4 flex gap-2 border-b border-slate-200"
      aria-label="Data tables"
    >
      <button
        type="button"
        onClick={() => onTabChange("master")}
        className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
          activeTab === "master"
            ? "border-indigo-600 text-indigo-700"
            : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
        }`}
      >
        Master File
      </button>
      <button
        type="button"
        onClick={() => onTabChange("raw")}
        className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
          activeTab === "raw"
            ? "border-indigo-600 text-indigo-700"
            : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
        }`}
      >
        Raw Data
      </button>

      <button
        type="button"
        onClick={() => onTabChange("processed")}
        className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
          activeTab === "processed"
            ? "border-indigo-600 text-indigo-700"
            : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
        }`}
      >
        Processed Data
      </button>

    </nav>
  );
}

function GpsLocationLayer({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 1) {
      map.setView(
        [locations[0].latitude, locations[0].longitude],
        18,
        { animate: true }
      );
    } else if (locations.length > 1) {
      map.fitBounds(
        locations.map(({ latitude, longitude }) => [latitude, longitude]),
        { padding: [40, 40], maxZoom: 17, animate: true }
      );
    }
  }, [locations, map]);

  return locations.map((location, index) => (
    <GpsLocationMarker
      key={`${location.dataType || "processed"}-${location.recordId}-${location.filename || "gps-location"}-${index}`}
      location={location}
    />
  ));
}

function GpsLocationMarker({ location }) {
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

  useEffect(() => {
    if (!location.filename) {
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl;
    let isActive = true;

    async function loadThumbnail() {
      setThumbnailLoading(true);

      try {
        const token = localStorage.getItem("access_token");
        const response = await api.get(
          `/${location.dataType === "raw" ? "raw-data" : "processed-data"}/${location.recordId}/preview?filename=${encodeURIComponent(location.filename)}`,
          {
            responseType: "blob",
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        if (isActive) {
          objectUrl = URL.createObjectURL(response.data);
          setThumbnailUrl(objectUrl);
        }
      } catch (error) {
        if (isActive && error.name !== "CanceledError") {
          console.error("Unable to load GPS marker thumbnail:", error);
        }
      } finally {
        if (isActive) {
          setThumbnailLoading(false);
        }
      }
    }

    loadThumbnail();

    return () => {
      isActive = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [location.dataType, location.filename, location.recordId]);

  const imageMarkerIcon = useMemo(() => {
    if (location.dataType === "raw" || !thumbnailUrl) {
      return gpsMarkerIcon;
    }

    return L.divIcon({
      className: "",
      html: `
        <div style="position:relative;width:88px;height:84px;">
          <img
            src="${thumbnailUrl}"
            alt=""
            style="display:block;width:88px;height:72px;object-fit:cover;border:2px solid white;border-radius:4px;box-shadow:0 1px 5px rgba(15,23,42,.5);"
          />
          <div style="position:absolute;left:37px;top:70px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid white;filter:drop-shadow(0 2px 1px rgba(15,23,42,.4));"></div>
        </div>
      `,
      iconSize: [88, 84],
      iconAnchor: [44, 84],
    });
  }, [location.dataType, thumbnailUrl]);

  return (
    <>
      <Marker
        position={[location.latitude, location.longitude]}
        icon={imageMarkerIcon}
        title={
          thumbnailLoading
            ? "Loading image overlay"
            : location.filename || "GPS location"
        }
      >
        <Popup maxWidth={340} minWidth={260}>
          <div className="max-h-80 space-y-2 overflow-y-auto p-1">
            <h2 className="text-sm font-semibold text-slate-900">
              {location.filename || "GPS location"}
            </h2>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={location.filename || "Data image"}
                className="max-h-48 w-full rounded border border-slate-200 object-contain"
              />
            ) : (
              <p className="text-xs text-slate-500">
                {thumbnailLoading
                  ? "Loading image…"
                  : "Image preview is unavailable."}
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
              <dt className="font-semibold text-slate-600">Latitude</dt>
              <dd className="break-all text-slate-800">
                {location.latitude.toFixed(6)}
              </dd>
              <dt className="font-semibold text-slate-600">Longitude</dt>
              <dd className="break-all text-slate-800">
                {location.longitude.toFixed(6)}
              </dd>
              {location.record &&
                (location.dataType === "raw"
                  ? rawDataColumns
                  : processedDataColumns
                ).map((column) => {
                  const value = formatValue(
                    column.key,
                    location.record[column.key]
                  );

                  return value ? (
                    <Fragment key={column.key}>
                      <dt className="font-semibold text-slate-600">
                        {column.label}
                      </dt>
                      <dd className="break-all text-slate-800">{value}</dd>
                    </Fragment>
                  ) : null;
                })}
              {location.record?.uploaded_at && (
                <>
                  <dt className="font-semibold text-slate-600">Uploaded At</dt>
                  <dd className="break-all text-slate-800">
                    {formatValue("uploaded_at", location.record.uploaded_at)}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

function RawDataTab({
  onHighlightRecord,
  onRecordsLoaded,
  barangayData,
  searchTerm,
  dateFrom,
  dateTo,
  municipalityFilter,
  barangayFilter,
  districtFilter,
}) {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const detailsDialogRef = useRef(null);
  const [imageViewerRecord, setImageViewerRecord] = useState(null);
  const imageViewerDialogRef = useRef(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeImageUrl, setActiveImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageFolderPath, setImageFolderPath] = useState("");
  const [folderOpenError, setFolderOpenError] = useState("");

  const openFolderInExplorer = async (record) => {
    setFolderOpenError("");

    try {
      await api.post(
        `/raw-data/${record.raw_data_id}/open-folder`,
        {},
        getPreviewRequestConfig()
      );
    } catch (error) {
      const detail = error.response?.data?.detail;
      setFolderOpenError(
        (typeof detail === "string" ? detail : detail?.message) ||
          "Unable to open the folder in File Explorer."
      );
    }
  };

  const handleOpenFolder = async () => {
    setFolderOpenError("");

    try {
      const result = await window.desktopAPI?.openFolder(imageFolderPath);
      if (!result?.success) {
        setFolderOpenError(
          result?.error || "Open this record in the installed desktop app."
        );
      }
    } catch (error) {
      setFolderOpenError(error.message || "Unable to open the folder.");
    }
  };

  const getPreviewRequestConfig = (options = {}) => {
    const token = localStorage.getItem("access_token");

    return {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  };

  const openImageViewer = async (record) => {
    setImageViewerRecord(record);
    setPreviewImages([]);
    setActiveImageIndex(0);
    setActiveImageUrl("");
    setImageError("");
    setImageFolderPath("");
    setImageLoading(true);

    try {
      const response = await api.get(
        `/raw-data/${record.raw_data_id}/preview`,
        getPreviewRequestConfig({ responseType: "blob" })
      );
      const contentType = response.headers["content-type"] || response.data.type;

      if (contentType?.startsWith("image/")) {
        const filename = String(record.full_path ?? "")
          .split(/[\\/]/)
          .pop();
        setPreviewImages([{ filename }]);
        return;
      }

      const data = JSON.parse(await response.data.text());
      if (!data.images?.length) {
        setImageError("No JPG, JPEG, or PNG images were found.");
        return;
      }

      setPreviewImages(data.images);
    } catch (error) {
      let detail = error.response?.data?.detail;
      if (error.response?.data instanceof Blob) {
        try {
          const errorData = JSON.parse(await error.response.data.text());
          detail = errorData.detail;
        } catch {
          detail = null;
        }
      }

      if (detail && typeof detail === "object" && detail.folder_path) {
        setImageFolderPath(detail.folder_path);
      }

      setImageError(
        (typeof detail === "string" ? detail : detail?.message) ||
          "Unable to load images from this folder."
      );
    } finally {
      setImageLoading(false);
    }
  };

  useEffect(() => {
    if (
      imageViewerRecord &&
      imageViewerDialogRef.current &&
      !imageViewerDialogRef.current.open
    ) {
      imageViewerDialogRef.current.showModal();
    }
  }, [imageViewerRecord]);

  useEffect(() => {
    const image = previewImages[activeImageIndex];
    if (!imageViewerRecord || !image) {
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl;
    let isActive = true;

    async function loadImage() {
      setImageLoading(true);
      setImageError("");
      setActiveImageUrl("");

      try {
        const response = await api.get(
          `/raw-data/${imageViewerRecord.raw_data_id}/preview?filename=${encodeURIComponent(image.filename)}`,
          getPreviewRequestConfig({
            responseType: "blob",
            signal: controller.signal,
          })
        );

        if (isActive) {
          objectUrl = URL.createObjectURL(response.data);
          setActiveImageUrl(objectUrl);
        }
      } catch (error) {
        if (isActive && error.name !== "CanceledError") {
          setImageError("Unable to display this image.");
        }
      } finally {
        if (isActive) {
          setImageLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      isActive = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [activeImageIndex, imageViewerRecord, previewImages]);

  useEffect(() => {
    let isActive = true;

    async function fetchRawData() {
      setLoading(true);
      setError(false);

      try {
        const response = await api.get("/raw-data/");

        if (isActive) {
          setRawData(response.data);
          onRecordsLoaded(response.data);
        }
      } catch (err) {
        console.error("Error fetching raw data:", err);

        if (isActive) {
          setError(true);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchRawData();

    return () => {
      isActive = false;
    };
  }, [onRecordsLoaded, retryCount]);

  useEffect(() => {
    if (
      selectedRecord &&
      detailsDialogRef.current &&
      !detailsDialogRef.current.open
    ) {
      detailsDialogRef.current.showModal();
    }
  }, [selectedRecord]);

const normalizedSearch = searchTerm.trim().toLowerCase();
const districtMunicipalityCodes = new Map();
(barangayData?.features ?? []).forEach((feature) => {
  const district = String(feature.properties?.DISTRICT ?? "").trim();
  const lgu = String(feature.properties?.LGU ?? "").trim();
  const municipalityCode = getMunicipalityCodeFromPSGC(
    feature.properties?.PSGC_CODE
  );

  if (!district || !lgu || !municipalityCode) {
    return;
  }

  if (!districtMunicipalityCodes.has(district)) {
    districtMunicipalityCodes.set(district, new Set());
  }

  districtMunicipalityCodes.get(district).add(municipalityCode);
});
const filteredRawData = rawData.filter((record) => {
  const matchesSearch =
    !normalizedSearch ||
    rawDataColumns.some((column) =>
      String(record[column.key] ?? "")
        .toLowerCase()
        .includes(normalizedSearch)
    );

  const creationDate =
    typeof record.creation_date === "string"
      ? record.creation_date.slice(0, 10)
      : "";
  const matchesDateFrom = !dateFrom || creationDate >= dateFrom;
  const matchesDateTo = !dateTo || creationDate <= dateTo;
  const pscg = String(record.pscg ?? "").trim();
  const municipalityCode = getMunicipalityCodeFromPSGC(pscg);
  const matchesMunicipality =
    !municipalityFilter || municipalityCode === municipalityFilter;
  const matchesBarangay = !barangayFilter || pscg === barangayFilter;
  const matchesDistrict =
    !districtFilter ||
    districtMunicipalityCodes.get(districtFilter)?.has(municipalityCode);

  return (
    matchesSearch &&
    matchesDateFrom &&
    matchesDateTo &&
    matchesMunicipality &&
    matchesBarangay &&
    matchesDistrict
  );
});
  return (
<>

<dialog
  ref={detailsDialogRef}
  aria-labelledby="raw-data-details-title"
  onClose={() => setSelectedRecord(null)}
  onClick={(event) => {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }}
  className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl border-0 bg-transparent p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/50"
>
  {selectedRecord && (
    <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Raw data details
          </p>
          <h2
            id="raw-data-details-title"
            className="mt-1 truncate text-lg font-semibold text-slate-900"
          >
            Record {selectedRecord.raw_data_id}
          </h2>
        </div>
        <button
          type="button"
          autoFocus
          onClick={() => detailsDialogRef.current?.close()}
          aria-label="Close raw data details"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <span aria-hidden="true" className="text-xl leading-none">×</span>
        </button>
      </header>

      <dl className="grid gap-x-6 overflow-y-auto px-5 py-4 sm:grid-cols-2">
        {rawDataColumns.map((column) => {
          const value = formatValue(
            column.key,
            selectedRecord[column.key]
          );

          return (
            <div
              key={column.key}
              className="border-b border-slate-100 py-3"
            >
              <dt className="text-xs font-semibold text-slate-500">
                {column.label}
              </dt>
              <dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-800">
                {value || <span className="text-slate-300">—</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      <footer className="border-t border-slate-200 px-5 py-3 text-right">
        <button
          type="button"
          onClick={() => detailsDialogRef.current?.close()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Close
        </button>
      </footer>
    </div>
  )}
</dialog>

<dialog
  ref={imageViewerDialogRef}
  aria-labelledby="raw-data-image-title"
  onClose={() => {
    setImageViewerRecord(null);
    setPreviewImages([]);
    setActiveImageUrl("");
    setImageFolderPath("");
  }}
  onClick={(event) => {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }}
  className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-xl border-0 bg-transparent p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/70"
>
  {imageViewerRecord && (
    <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Raw data image preview
          </p>
          <h2
            id="raw-data-image-title"
            className="mt-1 truncate text-lg font-semibold text-slate-900"
            title={imageViewerRecord.full_path}
          >
            {previewImages[activeImageIndex]?.filename ||
              imageViewerRecord.full_path}
          </h2>
          {previewImages.length > 1 && (
            <p className="mt-1 text-xs text-slate-500">
              Image {activeImageIndex + 1} of {previewImages.length}
            </p>
          )}
        </div>
        <button
          type="button"
          autoFocus
          onClick={() => imageViewerDialogRef.current?.close()}
          aria-label="Close image preview"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>

      <div className="flex min-h-64 flex-1 items-center justify-center overflow-auto bg-slate-950 p-4">
        {imageLoading ? (
          <div
            aria-live="polite"
            className="flex items-center gap-3 text-sm text-white"
          >
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-slate-500 border-t-white"
            />
            Loading image…
          </div>
        ) : imageError ? (
          <div className="max-w-2xl space-y-3 text-center">
            <p role="alert" className="text-sm text-white">
              {imageError}
            </p>
            {imageFolderPath && (
              <div className="space-y-3 rounded-lg bg-slate-800 p-4 text-left">
                <p className="text-xs font-semibold text-slate-200">
                  Folder location
                </p>
                <code className="block break-all text-sm text-white">
                  {imageFolderPath}
                </code>
                {window.desktopAPI?.openFolder ? (
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    className="inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Open in File Explorer
                  </button>
                ) : (
                  getFolderFileUrl(imageFolderPath) && (
                  <a
                    href={getFolderFileUrl(imageFolderPath)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Try opening folder
                  </a>
                  )
                )}
                {folderOpenError && (
                  <p role="alert" className="text-xs text-red-300">
                    {folderOpenError}
                  </p>
                )}
                {!window.desktopAPI?.openFolder && (
                  <p className="text-xs text-slate-300">
                    Your browser may block links to folders on the server.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : activeImageUrl ? (
          <img
            src={activeImageUrl}
            alt={previewImages[activeImageIndex]?.filename || "Raw data preview"}
            className="max-h-[calc(90vh-10rem)] max-w-full object-contain"
          />
        ) : (
          <ImageIcon aria-hidden="true" className="size-10 text-slate-500" />
        )}
      </div>

      {previewImages.length > 1 && (
        <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={() => setActiveImageIndex((index) => index - 1)}
            disabled={activeImageIndex === 0 || imageLoading}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => setActiveImageIndex((index) => index + 1)}
            disabled={
              activeImageIndex === previewImages.length - 1 || imageLoading
            }
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </footer>
      )}
    </div>
  )}
</dialog>

    <section
      aria-label="Raw data records"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500"
        >
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
          />
          Loading raw data…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex min-h-48 flex-col items-center justify-center px-6 text-center"
        >
          <p className="text-sm font-semibold text-slate-700">
            Unable to load raw data
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Check your connection and try again.
          </p>

          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-4 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      ) : rawData.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No raw data found
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Raw data records will appear here once they are imported.
          </p>
        </div>
      ) : filteredRawData.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No matching records
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search, date, municipality, district, or barangay filters.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-900">Raw Data Records</h2>
            <p className="text-xs text-slate-500">
              Showing {filteredRawData.length} of {rawData.length} records
            </p>
          </div>

          <div className="max-h-[calc(100vh-230px)] min-h-48 overflow-auto">
            <table className="w-full min-w-max border-separate border-spacing-0 text-left text-xs text-slate-600">
              <thead className="sticky top-0 z-10 bg-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
                <tr>
                  {rawDataColumns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="whitespace-nowrap border-b border-slate-700 px-2.5 py-2.5"
                    >
                      {column.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="sticky right-0 border-b border-slate-700 bg-slate-800 px-2.5 py-2.5"
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRawData.map((record) => (
                  <tr
                    key={record.raw_data_id}
                    onClick={() => openImageViewer(record)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openImageViewer(record);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Show image preview for raw data record ${record.raw_data_id}`}
                    className="cursor-pointer odd:bg-white even:bg-slate-50/70 hover:bg-indigo-50/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600"
                  >
                    {rawDataColumns.map((column) => {
                      const value = formatValue(
                        column.key,
                        record[column.key]
                      );

                      return (
                        <td
                          key={column.key}
                          className="max-w-64 border-b border-slate-100 px-2.5 py-2 align-top"
                        >
                          {column.key === "raw_data_id" ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onHighlightRecord(record);
                              }}
                              aria-label={`Locate raw data record ${record.raw_data_id} on map`}
                              title="Locate and highlight on map"
                              className="font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-indigo-600"
                            >
                              {value}
                            </button>
                          ) : column.key === "full_path" && value ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openFolderInExplorer(record);
                              }}
                              title={`Open folder: ${value}`}
                              className="block max-w-64 truncate text-indigo-600 underline decoration-dotted underline-offset-2 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-indigo-600"
                            >
                              {value}
                            </button>
                          ) : (
                            <span
                              className="block max-w-64 truncate"
                              title={value || undefined}
                            >
                              {value || (
                                <span className="text-slate-300">—</span>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 border-b border-slate-100 bg-inherit px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedRecord(record);
                          }}
                          aria-label={`More details for raw data record ${record.raw_data_id}`}
                          title="View full details"
                          className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-indigo-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          <Ellipsis aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onHighlightRecord(record);
                          }}
                          aria-label={`Highlight raw data record ${record.raw_data_id} on map`}
                          title="Highlight location on map"
                          className="inline-flex size-8 items-center justify-center rounded-md text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          <MapPin aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {folderOpenError && (
            <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {folderOpenError}
            </p>
          )}
        </>
      )}
    </section>

    </>
  );
}

function ProcessedDataTab({
  searchTerm,
  dateFrom,
  dateTo,
  municipalityFilter,
  barangayFilter,
  districtFilter,
  districtMunicipalityCodes,
  onNavigateRecord,
  onRecordsLoaded,
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [folderOpenError, setFolderOpenError] = useState("");
  const detailsDialogRef = useRef(null);
  const [imageViewerRecord, setImageViewerRecord] = useState(null);
  const imageViewerDialogRef = useRef(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeImageUrl, setActiveImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageFolderPath, setImageFolderPath] = useState("");

  const openFolderInExplorer = async (record) => {
    setFolderOpenError("");

    try {
      const token = localStorage.getItem("access_token");
      await api.post(
        `/processed-data/${record.id}/open-folder`,
        {},
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setFolderOpenError(
        (typeof detail === "string" ? detail : detail?.message) ||
          "Unable to open the folder in File Explorer."
      );
    }
  };

  const openImageViewer = async (record) => {
    setImageViewerRecord(record);
    setPreviewImages([]);
    setActiveImageIndex(0);
    setActiveImageUrl("");
    setImageError("");
    setImageFolderPath("");
    setFolderOpenError("");
    setImageLoading(true);

    try {
      const token = localStorage.getItem("access_token");
      const response = await api.get(
        `/processed-data/${record.id}/preview`,
        {
          responseType: "blob",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const contentType = response.headers["content-type"] || response.data.type;

      if (contentType?.startsWith("image/")) {
        const filename = String(record["Full path"] ?? "")
          .split(/[\\/]/)
          .pop();
        setPreviewImages([{ filename }]);
        return;
      }

      const data = JSON.parse(await response.data.text());
      if (!data.images?.length) {
        setImageError("No JPG, JPEG, or PNG images were found.");
        setImageFolderPath(data.folder_path || record["Full path"] || "");
        return;
      }

      setPreviewImages(data.images);
    } catch (requestError) {
      let detail = requestError.response?.data?.detail;
      if (requestError.response?.data instanceof Blob) {
        try {
          const responseData = JSON.parse(
            await requestError.response.data.text()
          );
          detail = responseData.detail;
        } catch {
          detail = null;
        }
      }

      if (detail && typeof detail === "object" && detail.folder_path) {
        setImageFolderPath(detail.folder_path);
      } else if (
        requestError.response?.status === 404 ||
        requestError.response?.status === 415
      ) {
        setImageFolderPath(record["Full path"] || "");
      }

      setImageError(
        (typeof detail === "string" ? detail : detail?.message) ||
          "Unable to load images from this folder."
      );
    } finally {
      setImageLoading(false);
    }
  };

  const handleOpenImageFolder = async () => {
    setFolderOpenError("");

    try {
      const result = await window.desktopAPI?.openFolder(imageFolderPath);
      if (!result?.success) {
        setFolderOpenError(
          result?.error || "Open this record in the installed desktop app."
        );
      }
    } catch (requestError) {
      setFolderOpenError(
        requestError.message || "Unable to open the folder."
      );
    }
  };

  const reloadRecords = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/processed-data/");
      setRecords(response.data);
    } catch (requestError) {
      console.error("Error loading processed data:", requestError);
      setError("Unable to load processed data. Check your backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    api
      .get("/processed-data/")
      .then((response) => {
        if (isActive) {
          setRecords(response.data);
          onRecordsLoaded(response.data);
        }
      })
      .catch((requestError) => {
        console.error("Error loading processed data:", requestError);
        if (isActive) {
          setError(
            "Unable to load processed data. Check your backend connection."
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onRecordsLoaded]);

  useEffect(() => {
    if (
      selectedRecord &&
      detailsDialogRef.current &&
      !detailsDialogRef.current.open
    ) {
      detailsDialogRef.current.showModal();
    }
  }, [selectedRecord]);

  useEffect(() => {
    if (
      imageViewerRecord &&
      imageViewerDialogRef.current &&
      !imageViewerDialogRef.current.open
    ) {
      imageViewerDialogRef.current.showModal();
    }
  }, [imageViewerRecord]);

  useEffect(() => {
    const image = previewImages[activeImageIndex];
    if (!imageViewerRecord || !image) {
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl;
    let isActive = true;

    async function loadImage() {
      setImageLoading(true);
      setImageError("");
      setActiveImageUrl("");

      try {
        const token = localStorage.getItem("access_token");
        const response = await api.get(
          `/processed-data/${imageViewerRecord.id}/preview?filename=${encodeURIComponent(image.filename)}`,
          {
            responseType: "blob",
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        if (isActive) {
          objectUrl = URL.createObjectURL(response.data);
          setActiveImageUrl(objectUrl);
        }
      } catch (requestError) {
        if (isActive && requestError.name !== "CanceledError") {
          setImageError("Unable to display this image.");
        }
      } finally {
        if (isActive) {
          setImageLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      isActive = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [activeImageIndex, imageViewerRecord, previewImages]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredRecords = [...records]
    .sort((first, second) => Number(first.id) - Number(second.id))
    .filter((record) => {
    const matchesSearch =
      !normalizedSearch ||
      [
        record.id,
        ...processedDataColumns.map(({ key }) => record[key]),
        record.uploaded_at,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(normalizedSearch)
      );
    const creationDate =
      typeof record["Creation date"] === "string"
        ? record["Creation date"].slice(0, 10)
        : "";
    const matchesDateFrom = !dateFrom || creationDate >= dateFrom;
    const matchesDateTo = !dateTo || creationDate <= dateTo;
    const psgc = String(record.PSCG ?? "").trim();
    const matchesMunicipality =
      !municipalityFilter ||
      psgc.substring(0, 7) + "000" === municipalityFilter;
    const matchesBarangay = !barangayFilter || psgc === barangayFilter;
    const matchesDistrict =
      !districtFilter ||
      districtMunicipalityCodes
        .get(districtFilter)
        ?.has(psgc.substring(0, 7) + "000");

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesMunicipality &&
      matchesBarangay &&
      matchesDistrict
    );
    });

  return (
    <>
    <dialog
      ref={imageViewerDialogRef}
      aria-labelledby="processed-data-image-title"
      onClose={() => {
        setImageViewerRecord(null);
        setPreviewImages([]);
        setActiveImageUrl("");
        setImageFolderPath("");
        setFolderOpenError("");
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.currentTarget.close();
        }
      }}
      className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-xl border-0 bg-transparent p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/70"
    >
      {imageViewerRecord && (
        <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Processed data image preview
              </p>
              <h2
                id="processed-data-image-title"
                className="mt-1 truncate text-lg font-semibold text-slate-900"
                title={imageViewerRecord["Full path"]}
              >
                {previewImages[activeImageIndex]?.filename ||
                  imageViewerRecord["Full path"]}
              </h2>
              {previewImages.length > 1 && (
                <p className="mt-1 text-xs text-slate-500">
                  Image {activeImageIndex + 1} of {previewImages.length}
                </p>
              )}
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => imageViewerDialogRef.current?.close()}
              aria-label="Close image preview"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>

          <div className="flex min-h-64 flex-1 items-center justify-center overflow-auto bg-slate-950 p-4">
            {imageLoading ? (
              <div
                aria-live="polite"
                className="flex items-center gap-3 text-sm text-white"
              >
                <span
                  aria-hidden="true"
                  className="size-4 animate-spin rounded-full border-2 border-slate-500 border-t-white"
                />
                Loading image…
              </div>
            ) : imageError ? (
              <div className="max-w-2xl space-y-3 text-center">
                <p role="alert" className="text-sm text-white">
                  {imageError}
                </p>
                {imageFolderPath && (
                  <div className="space-y-3 rounded-lg bg-slate-800 p-4 text-left">
                    <p className="text-xs font-semibold text-slate-200">
                      Folder location
                    </p>
                    <code className="block break-all text-sm text-white">
                      {imageFolderPath}
                    </code>
                    {window.desktopAPI?.openFolder ? (
                      <button
                        type="button"
                        onClick={handleOpenImageFolder}
                        className="inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        Open in File Explorer
                      </button>
                    ) : (
                      getFolderFileUrl(imageFolderPath) && (
                        <a
                          href={getFolderFileUrl(imageFolderPath)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                          Try opening folder
                        </a>
                      )
                    )}
                    {folderOpenError && (
                      <p role="alert" className="text-xs text-red-300">
                        {folderOpenError}
                      </p>
                    )}
                    {!window.desktopAPI?.openFolder && (
                      <p className="text-xs text-slate-300">
                        Your browser may block links to folders on the server.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : activeImageUrl ? (
              <img
                src={activeImageUrl}
                alt={
                  previewImages[activeImageIndex]?.filename ||
                  "Processed data preview"
                }
                className="max-h-[calc(90vh-10rem)] max-w-full object-contain"
              />
            ) : (
              <ImageIcon
                aria-hidden="true"
                className="size-10 text-slate-500"
              />
            )}
          </div>

          {previewImages.length > 1 && (
            <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setActiveImageIndex((index) => index - 1)}
                disabled={activeImageIndex === 0 || imageLoading}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setActiveImageIndex((index) => index + 1)}
                disabled={
                  activeImageIndex === previewImages.length - 1 || imageLoading
                }
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </footer>
          )}
        </div>
      )}
    </dialog>
    <section
      aria-label="Processed data records"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-900">
            Processed Data Records
          </h2>
          {!loading && !error && (
            <p className="mt-1 text-xs text-slate-500">
              Showing {filteredRecords.length} of {records.length} records
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-48 items-center justify-center text-sm text-slate-500"
        >
          Loading processed data...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex min-h-48 flex-col items-center justify-center px-5 text-center"
        >
          <p className="text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={reloadRecords}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
          <p className="font-medium text-slate-700">No processed data found</p>
          <p className="mt-1 text-sm text-slate-500">
            Processed records will appear here.
          </p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
          <p className="font-medium text-slate-700">
            No matching processed data
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="max-h-[calc(100vh-230px)] min-h-48 overflow-auto">
          <table className="w-full min-w-max border-separate border-spacing-0 text-left text-xs text-slate-600">
            <thead className="sticky top-0 z-10 bg-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
              <tr>
                <th className="whitespace-nowrap border-b border-slate-700 px-2.5 py-2.5">
                  ID
                </th>
                {processedDataColumns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="whitespace-nowrap border-b border-slate-700 px-2.5 py-2.5"
                  >
                    {column.label}
                  </th>
                ))}
                <th className="whitespace-nowrap border-b border-slate-700 px-2.5 py-2.5">
                  Uploaded At
                </th>
                <th className="sticky right-0 whitespace-nowrap border-b border-slate-700 bg-slate-800 px-2.5 py-2.5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => openImageViewer(record)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openImageViewer(record);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Show image preview for processed data record ${record.id}`}
                  className="cursor-pointer odd:bg-white even:bg-slate-50/70 hover:bg-indigo-50/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600"
                >
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {record.id}
                  </td>
                  {processedDataColumns.map((column) => {
                    const value = formatValue(column.key, record[column.key]);

                    return (
                      <td
                        key={column.key}
                        className="max-w-48 border-b border-slate-100 px-2.5 py-2 align-top"
                      >
                        {column.key === "Full path" && value ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openFolderInExplorer(record);
                            }}
                            title={`Open folder: ${value}`}
                            className="block max-w-48 truncate text-indigo-600 underline decoration-dotted underline-offset-2 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-indigo-600"
                          >
                            {value}
                          </button>
                        ) : (
                          <span
                            className="block max-w-48 truncate"
                            title={value || undefined}
                          >
                            {value || (
                              <span className="text-slate-300">—</span>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {formatValue("uploaded_at", record.uploaded_at)}
                  </td>
                  <td className="sticky right-0 border-b border-slate-100 bg-inherit px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedRecord(record);
                        }}
                        aria-label={`More details for processed data record ${record.id}`}
                        title="View full details"
                        className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-indigo-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      >
                        <Ellipsis aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onNavigateRecord(record);
                        }}
                        aria-label={`Highlight processed data record ${record.id} on map`}
                        title="Highlight location on map"
                        className="inline-flex size-8 items-center justify-center rounded-md text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      >
                        <MapPin aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {folderOpenError && (
        <p
          role="alert"
          className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          {folderOpenError}
        </p>
      )}
    </section>
    <dialog
      ref={detailsDialogRef}
      aria-labelledby="processed-data-details-title"
      onClose={() => setSelectedRecord(null)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.currentTarget.close();
        }
      }}
      className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl border-0 bg-transparent p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/50"
    >
      {selectedRecord && (
        <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Processed data details
              </p>
              <h2
                id="processed-data-details-title"
                className="mt-1 truncate text-lg font-semibold text-slate-900"
              >
                Record {selectedRecord.id}
              </h2>
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => detailsDialogRef.current?.close()}
              aria-label="Close processed data details"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>
          <dl className="grid gap-x-6 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            <div className="border-b border-slate-100 py-3">
              <dt className="text-xs font-semibold text-slate-500">ID</dt>
              <dd className="mt-1 break-words text-sm text-slate-800">
                {selectedRecord.id}
              </dd>
            </div>
            {processedDataColumns.map((column) => {
              const value = formatValue(
                column.key,
                selectedRecord[column.key]
              );

              return (
                <div
                  key={column.key}
                  className="border-b border-slate-100 py-3"
                >
                  <dt className="text-xs font-semibold text-slate-500">
                    {column.label}
                  </dt>
                  <dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-800">
                    {value || <span className="text-slate-300">—</span>}
                  </dd>
                </div>
              );
            })}
            <div className="border-b border-slate-100 py-3">
              <dt className="text-xs font-semibold text-slate-500">
                Uploaded At
              </dt>
              <dd className="mt-1 break-words text-sm text-slate-800">
                {formatValue("uploaded_at", selectedRecord.uploaded_at) || (
                  <span className="text-slate-300">—</span>
                )}
              </dd>
            </div>
          </dl>
          <footer className="border-t border-slate-200 px-5 py-3 text-right">
            <button
              type="button"
              onClick={() => detailsDialogRef.current?.close()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Close
            </button>
          </footer>
        </div>
      )}
    </dialog>
    </>
  );
}

function MasterFile() {
  const [activeTab, setActiveTab] = useState("master");
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [selectedBarangayState, setSelectedBarangay] = useState(null);
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [masterFiles, setMasterFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rawSearchTerm, setRawSearchTerm] = useState("");
  const [rawDateFrom, setRawDateFrom] = useState("");
  const [rawDateTo, setRawDateTo] = useState("");
  const [processedSearchTerm, setProcessedSearchTerm] = useState("");
  const [processedDateFrom, setProcessedDateFrom] = useState("");
  const [processedDateTo, setProcessedDateTo] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const detailsDialogRef = useRef(null);
  const [municipalityData, setMunicipalityData] = useState(null);
  const [barangayData, setBarangayData] = useState(null);
  const [rawLocationCounts, setRawLocationCounts] = useState(() =>
    getLocationCounts([], (record) => record.pscg)
  );
  const [processedLocationCounts, setProcessedLocationCounts] = useState(() =>
    getLocationCounts([], (record) => record.PSCG)
  );
  const [selectedGpsLocations, setSelectedGpsLocations] = useState([]);
  const [mapNavigationError, setMapNavigationError] = useState("");
  const [loadingGpsLocations, setLoadingGpsLocations] = useState(false);
  const [selectedNavigationPSGC, setSelectedNavigationPSGC] = useState("");
  const gpsRequestIdRef = useRef(0);
  const selectedBarangay = selectedNavigationPSGC
    ? barangayData?.features.find(
        (feature) =>
          normalizePSGCCode(feature.properties?.PSGC_CODE) ===
          normalizePSGCCode(selectedNavigationPSGC)
      ) || null
    : selectedBarangayState;

  const handleRawRecordsLoaded = useCallback((records) => {
    setRawLocationCounts(getLocationCounts(records, (record) => record.pscg));
  }, []);
  const handleProcessedRecordsLoaded = useCallback((records) => {
    setProcessedLocationCounts(
      getLocationCounts(records, (record) => record.PSCG)
    );
  }, []);

  const retryMasterFiles = async () => {
    setLoading(true);
    setHasError(false);
    try {
      const response = await api.get("/masterfile/");
      setMasterFiles(response.data);
    } catch (error) {
      console.error("Error fetching master files:", error);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    api
      .get("/masterfile/")
      .then((response) => {
        if (isActive) {
          setMasterFiles(response.data);
        }
      })
      .catch((error) => {
        if (isActive) {
          console.error("Error fetching master files:", error);
          setHasError(true);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);


  useEffect(() => {
    if (selectedFile && detailsDialogRef.current && !detailsDialogRef.current.open) {
      detailsDialogRef.current.showModal();
    }
  }, [selectedFile]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const districtMunicipalityCodes = new Map();
  (barangayData?.features ?? []).forEach((feature) => {
    const district = String(feature.properties?.DISTRICT ?? "").trim();
    const lgu = String(feature.properties?.LGU ?? "").trim();
    const municipalityCode = getMunicipalityCodeFromPSGC(
      feature.properties?.PSGC_CODE
    );

    if (!district || !lgu || !municipalityCode) {
      return;
    }

    if (!districtMunicipalityCodes.has(district)) {
      districtMunicipalityCodes.set(district, new Set());
    }

    districtMunicipalityCodes.get(district).add(municipalityCode);
  });
  const municipalityOptions = Object.entries(municipalityPSGC)
    .filter(
      ([code]) =>
        !districtFilter ||
        districtMunicipalityCodes.get(districtFilter)?.has(code)
    )
    .sort(([, firstName], [, secondName]) =>
      firstName.localeCompare(secondName)
    );
  const barangayOptions = (barangayData?.features ?? [])
    .filter(
      (feature) =>
        !municipalityFilter ||
        String(feature.properties?.PSGC_CODE ?? "")
          .trim()
          .substring(0, 7) === municipalityFilter.substring(0, 7)
    )
    .sort((first, second) =>
      String(first.properties?.NAME ?? "").localeCompare(
        String(second.properties?.NAME ?? "")
      )
    );
  const districtFeatures = municipalityFilter
    ? barangayOptions
    : barangayData?.features ?? [];
  const districtOptions = [
    ...new Set(
      districtFeatures
        .map((feature) => String(feature.properties?.DISTRICT ?? "").trim())
        .filter(Boolean)
    ),
  ].sort((first, second) => first.localeCompare(second));
  const rawBarangayOptions = (barangayData?.features ?? [])
    .filter((feature) => {
      const matchesMunicipality =
        !municipalityFilter ||
        String(feature.properties?.PSGC_CODE ?? "")
          .trim()
          .substring(0, 7) === municipalityFilter.substring(0, 7);
      const matchesDistrict =
        !districtFilter ||
        String(feature.properties?.DISTRICT ?? "").trim() === districtFilter;

      return matchesMunicipality && matchesDistrict;
    })
    .sort((first, second) =>
      String(first.properties?.NAME ?? "").localeCompare(
        String(second.properties?.NAME ?? "")
      )
    );
  const filteredMasterFiles = masterFiles.filter((file) => {
    const matchesSearch =
      !normalizedSearch ||
      columns.some((column) => {
        const value =
          column.key === "extent" && file.extent
            ? JSON.stringify(file.extent)
            : file[column.key];
        return String(value ?? "").toLowerCase().includes(normalizedSearch);
      });

    const creationDate =
      typeof file.creation_date === "string"
        ? file.creation_date.slice(0, 10)
        : "";
    const matchesDateFrom = !dateFrom || creationDate >= dateFrom;
    const matchesDateTo = !dateTo || creationDate <= dateTo;
    const psgc = String(file.file_name ?? "").substring(0, 10).trim();
    const municipalityCode = getMunicipalityCodeFromPSGC(psgc);
    const matchesMunicipality =
      !municipalityFilter || municipalityCode === municipalityFilter;
    const matchesBarangay = !barangayFilter || psgc === barangayFilter;
    const matchesDistrict =
      !districtFilter ||
      districtMunicipalityCodes.get(districtFilter)?.has(municipalityCode);

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesMunicipality &&
      matchesBarangay &&
      matchesDistrict
    );
  });
  const hasActiveFilters = Boolean(
    normalizedSearch ||
      dateFrom ||
      dateTo ||
      municipalityFilter ||
      barangayFilter ||
      districtFilter
  );
  const hasActiveRawFilters = Boolean(
    rawSearchTerm.trim() ||
      rawDateFrom ||
      rawDateTo ||
      municipalityFilter ||
      barangayFilter ||
      districtFilter
  );
  const hasActiveProcessedFilters = Boolean(
    processedSearchTerm.trim() ||
      processedDateFrom ||
      processedDateTo ||
      municipalityFilter ||
      barangayFilter ||
      districtFilter
  );
  const masterLocationCounts = useMemo(
    () =>
      getLocationCounts(
        masterFiles,
        (file) => String(file.file_name ?? "").substring(0, 10)
      ),
    [masterFiles]
  );
  const activeLocationCounts =
    activeTab === "master"
      ? masterLocationCounts
      : activeTab === "raw"
        ? rawLocationCounts
        : processedLocationCounts;
  const municipalityCountsKey = JSON.stringify(
    [...activeLocationCounts.municipalityCounts].sort(([first], [second]) =>
      first.localeCompare(second)
    )
  );
useEffect(() => {
  Promise.all([
    fetch("/data/municipality.geojson").then((response) => response.json()),
    fetch("/data/barangay.geojson").then((response) => response.json()),
  ])
    .then(([municipality, barangay]) => {
      setMunicipalityData(municipality);
      setBarangayData(barangay);
    })
    .catch((error) => {
      console.error("Error loading GeoJSON:", error);
    });
}, []);

  async function handleHighlightRawRecord(record) {
    const requestId = gpsRequestIdRef.current + 1;
    gpsRequestIdRef.current = requestId;
    setSelectedGpsLocations([]);
    setMapNavigationError("");
    setLoadingGpsLocations(true);
    const pscg = normalizePSGCCode(record.pscg);
    const barangay = barangayData?.features.find(
      (feature) =>
        normalizePSGCCode(feature.properties?.PSGC_CODE) === pscg
    );
    const municipality =
      barangay?.properties?.LGU ?? getMunicipalityFromPSGC(pscg);

    setSelectedMunicipality(municipality);
    setSelectedNavigationPSGC(pscg);
    setSelectedBarangay(null);

    try {
      const token = localStorage.getItem("access_token");
      const response = await api.get(
        `/raw-data/${record.raw_data_id}/locations`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (requestId !== gpsRequestIdRef.current) {
        return;
      }

      const locations = (response.data?.locations ?? []).filter(
        ({ latitude, longitude }) =>
          Number.isFinite(Number(latitude)) &&
          Number.isFinite(Number(longitude)) &&
          Math.abs(Number(latitude)) <= 90 &&
          Math.abs(Number(longitude)) <= 180
      );

      if (locations.length === 0) {
        setMapNavigationError(
          "No GPS coordinates were found in this record's images."
        );
        return;
      }

      setSelectedGpsLocations(
        locations.map((location) => ({
          ...location,
          recordId: record.raw_data_id,
          record,
          dataType: "raw",
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        }))
      );
    } catch (error) {
      if (requestId !== gpsRequestIdRef.current) {
        return;
      }

      const detail = error.response?.data?.detail;
      setMapNavigationError(
        (typeof detail === "string" ? detail : detail?.message) ||
          "Unable to load GPS coordinates for this record."
      );
    } finally {
      if (requestId === gpsRequestIdRef.current) {
        setLoadingGpsLocations(false);
      }
    }
  }

  async function handleHighlightProcessedRecord(record) {
    const requestId = gpsRequestIdRef.current + 1;
    gpsRequestIdRef.current = requestId;
    setSelectedGpsLocations([]);
    setMapNavigationError("");
    setLoadingGpsLocations(true);
    const pscg = normalizePSGCCode(record.PSCG);
    const barangay = barangayData?.features.find(
      (feature) =>
        normalizePSGCCode(feature.properties?.PSGC_CODE) === pscg
    );
    const municipality =
      barangay?.properties?.LGU ?? getMunicipalityFromPSGC(pscg);

    setSelectedMunicipality(municipality);
    setSelectedNavigationPSGC(pscg);
    setSelectedBarangay(null);

    try {
      const token = localStorage.getItem("access_token");
      const response = await api.get(
        `/processed-data/${record.id}/locations`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (requestId !== gpsRequestIdRef.current) {
        return;
      }

      const locations = (response.data?.locations ?? []).filter(
        ({ latitude, longitude }) =>
          Number.isFinite(Number(latitude)) &&
          Number.isFinite(Number(longitude)) &&
          Math.abs(Number(latitude)) <= 90 &&
          Math.abs(Number(longitude)) <= 180
      );

      if (locations.length === 0) {
        setMapNavigationError(
          "No GPS coordinates were found in this record's images."
        );
        return;
      }

      setSelectedGpsLocations(
        locations.map((location) => ({
          ...location,
          recordId: record.id,
          record,
          dataType: "processed",
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        }))
      );
    } catch (error) {
      if (requestId !== gpsRequestIdRef.current) {
        return;
      }

      const detail = error.response?.data?.detail;
      setMapNavigationError(
        (typeof detail === "string" ? detail : detail?.message) ||
          "Unable to load GPS coordinates for this record."
      );
    } finally {
      if (requestId === gpsRequestIdRef.current) {
        setLoadingGpsLocations(false);
      }
    }
  }

  function handleMapMunicipalityClick(feature) {
    gpsRequestIdRef.current += 1;
    setLoadingGpsLocations(false);
    setSelectedGpsLocations([]);
    setMapNavigationError("");
    setSelectedNavigationPSGC("");
    const municipalityName = feature.properties?.LGU ?? null;
    const municipalityBarangay = barangayData?.features.find(
      (barangay) =>
        normalizeMunicipalityName(barangay.properties?.LGU) ===
        normalizeMunicipalityName(municipalityName)
    );
    const municipalityCode = getMunicipalityCodeFromPSGC(
      municipalityBarangay?.properties?.PSGC_CODE
    );
    const district = String(
      municipalityBarangay?.properties?.DISTRICT ?? ""
    ).trim();

    setSelectedMunicipality(municipalityName);
    setSelectedBarangay(null);
    setMunicipalityFilter(municipalityCode || "");
    setBarangayFilter("");
    setDistrictFilter(district);
  }

  function handleMapBarangayClick(feature) {
    gpsRequestIdRef.current += 1;
    setLoadingGpsLocations(false);
    setSelectedGpsLocations([]);
    setMapNavigationError("");
    setSelectedNavigationPSGC("");
    const psgc = String(feature.properties?.PSGC_CODE ?? "").trim();
    const selectedPSGC = String(
      selectedBarangay?.properties?.PSGC_CODE ?? ""
    ).trim();

    if (psgc && psgc === selectedPSGC) {
      setSelectedBarangay(null);
      setBarangayFilter("");
      return;
    }

    const municipality =
      feature.properties?.LGU ?? getMunicipalityFromPSGC(psgc);
    const district = String(feature.properties?.DISTRICT ?? "").trim();

    setSelectedMunicipality(municipality);
    setSelectedBarangay(feature);
    setMunicipalityFilter(getMunicipalityCodeFromPSGC(psgc) || "");
    setBarangayFilter(psgc);
    setDistrictFilter(district);
  }



  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Data catalog
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Master File Indexing
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Browse and review registered file metadata.
            </p>
          </div>
        </header>

        <section
          aria-label="Location map"
          className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">
              Click a barangay to filter the table, or Shift-click a map area to
              filter by its municipality.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === "master" && !loading && !hasError && (
                <label className="sr-only" htmlFor="master-file-search">
                  Search files
                </label>
              )}
              {activeTab === "master" && !loading && !hasError && (
                <input
                  id="master-file-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search file metadata…"
                  className="h-8 w-52 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:w-64"
                />
              )}
              {activeTab === "raw" && (
                <>
                  <label className="sr-only" htmlFor="raw-data-search">
                    Search raw data
                  </label>
                  <input
                    id="raw-data-search"
                    type="search"
                    value={rawSearchTerm}
                    onChange={(event) => setRawSearchTerm(event.target.value)}
                    placeholder="Search raw data…"
                    className="h-8 w-52 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:w-64"
                  />
                </>
              )}
              {activeTab === "processed" && (
                <>
                  <label className="sr-only" htmlFor="processed-data-search">
                    Search processed data
                  </label>
                  <input
                    id="processed-data-search"
                    type="search"
                    value={processedSearchTerm}
                    onChange={(event) =>
                      setProcessedSearchTerm(event.target.value)
                    }
                    placeholder="Search processed data…"
                    className="h-8 w-52 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:w-64"
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  gpsRequestIdRef.current += 1;
                  setLoadingGpsLocations(false);
                  setSelectedMunicipality(null);
                  setSelectedBarangay(null);
                  setSelectedNavigationPSGC("");
                  setSelectedGpsLocations([]);
                  setMapNavigationError("");
                  setMunicipalityFilter("");
                  setBarangayFilter("");
                  setDistrictFilter("");
                }}
                disabled={
                  !selectedMunicipality &&
                  !selectedBarangay &&
                  selectedGpsLocations.length === 0 &&
                  !mapNavigationError
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X aria-hidden="true" className="size-3.5" />
                Clear highlight
              </button>
            </div>
          </div>
          <div className="relative">
            <MapContainer
              center={[10.63, 122.96]}
              zoom={12}
              className="h-[500px] w-full"
            >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <GpsLocationLayer locations={selectedGpsLocations} />
            {municipalityData && (
              <Pane name="municipality-features" style={{ zIndex: 410 }}>
                <GeoJSON
                  key={`${activeTab}-${selectedMunicipality || "none"}-${selectedBarangay?.properties?.PSGC_CODE || "none"}-${municipalityCountsKey}`}
                  data={municipalityData}
                  style={(feature) => {
                    const isSelected =
                      normalizeMunicipalityName(feature.properties.LGU) ===
                      normalizeMunicipalityName(selectedMunicipality);

                    return {
                      color: isSelected ? "#f91d11" : "#3544e9",
                      weight: isSelected ? 4 : 2,
                      fillColor: isSelected ? "#ff1818" : "#38f655",
                      fillOpacity: isSelected ? 0.35 : 0.05,
                      interactive: true,
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    const municipalityName = feature.properties?.LGU;

                    layer.on("click", () =>
                      handleMapMunicipalityClick(feature)
                    );

                    if (municipalityName && !selectedBarangay) {
                      const isSelected =
                        normalizeMunicipalityName(municipalityName) ===
                        normalizeMunicipalityName(selectedMunicipality);
                      const municipalityCode =
                        getMunicipalityCodeFromName(municipalityName);
                      const count =
                        activeLocationCounts.municipalityCounts.get(
                          municipalityCode
                        ) ?? 0;

                      layer.bindTooltip(
                        isSelected
                          ? `${municipalityName}: ${count}`
                          : String(count),
                        {
                        permanent: true,
                        direction: "center",
                        className: "map-feature-counter",
                        }
                      );
                    }
                  }}
                />
              </Pane>
            )}
            {barangayData && (
              <>
                <Pane name="barangay-features" style={{ zIndex: 420 }}>
                  <GeoJSON
                    data={barangayData}
                    style={{
                      color: "#2d2df9",
                      weight: 1,
                      fillColor: "#470404",
                      fillOpacity: 0.05,
                      interactive: true,
                    }}
                    onEachFeature={(feature, layer) => {
                      layer.on("click", (event) => {
                        if (event.originalEvent.shiftKey) {
                          handleMapMunicipalityClick({
                            properties: { LGU: feature.properties?.LGU },
                          });
                          return;
                        }

                        handleMapBarangayClick(feature);
                      });
                    }}
                  />
                </Pane>
                {selectedBarangay && (
                  <Pane name="selected-barangay" style={{ zIndex: 430 }}>
                    <GeoJSON
                      key={`${activeTab}-selected-${selectedBarangay.properties.PSGC_CODE}-${activeLocationCounts.barangayCounts.get(String(selectedBarangay.properties.PSGC_CODE).trim()) ?? 0}`}
                      data={selectedBarangay}
                      style={{
                        color: "#e9ff25",
                        weight: 4,
                        fillColor: "#35ff57",
                        fillOpacity: 0.35,
                        interactive: true,
                      }}
                      onEachFeature={(feature, layer) => {
                        const barangayName = feature.properties?.NAME;

                        layer.on("click", (event) => {
                          if (event.originalEvent.shiftKey) {
                            handleMapMunicipalityClick({
                              properties: { LGU: feature.properties?.LGU },
                            });
                            return;
                          }

                          handleMapBarangayClick(feature);
                        });

                        if (barangayName) {
                          const barangayCode = String(
                            feature.properties?.PSGC_CODE ?? ""
                          ).trim();
                          const count =
                            activeLocationCounts.barangayCounts.get(
                              barangayCode
                            ) ?? 0;

                          layer.bindTooltip(`${barangayName}: ${count}`, {
                            permanent: true,
                            direction: "center",
                            className: "map-feature-counter",
                          });
                        }
                      }}
                    />
                  </Pane>
                )}
              </>
            )}
            </MapContainer>
            {(loadingGpsLocations || mapNavigationError) && (
              <div
                role={mapNavigationError ? "alert" : "status"}
                className={`absolute right-3 top-3 z-[1000] max-w-[calc(100%-1.5rem)] rounded-lg px-3 py-2 text-sm shadow-lg ${
                  mapNavigationError
                    ? "bg-red-50 text-red-700"
                    : "bg-white text-slate-700"
                }`}
              >
                {loadingGpsLocations
                  ? "Finding GPS locations…"
                  : mapNavigationError}
              </div>
            )}
            {activeTab === "master" && !loading && !hasError && (
              <aside
                aria-label="Filter master files"
                className="absolute left-3 top-3 z-[1000] max-h-[calc(500px-1.5rem)] w-72 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Filters
                  </h2>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setDateFrom("");
                        setDateTo("");
                        setMunicipalityFilter("");
                        setBarangayFilter("");
                        setDistrictFilter("");
                      }}
                      className="text-xs font-semibold text-indigo-700 transition hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Date from
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Date to
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Municipality
                    <select
                      value={municipalityFilter}
                      onChange={(event) => {
                        setMunicipalityFilter(event.target.value);
                        setBarangayFilter("");
                      }}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">All municipalities</option>
                      {municipalityOptions.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    District
                    <select
                      value={districtFilter}
                      onChange={(event) => {
                        setDistrictFilter(event.target.value);
                        setMunicipalityFilter("");
                        setBarangayFilter("");
                      }}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">All districts</option>
                      {districtOptions.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Barangay
                    <select
                      value={barangayFilter}
                      onChange={(event) => setBarangayFilter(event.target.value)}
                      disabled={!municipalityFilter}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">All barangays</option>
                      {barangayOptions.map((feature) => (
                        <option
                          key={feature.properties.PSGC_CODE}
                          value={String(feature.properties.PSGC_CODE).trim()}
                        >
                          {feature.properties.NAME}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </aside>
            )}
            {activeTab === "raw" && (
              <aside
                aria-label="Filter raw data"
                className="absolute left-3 top-3 z-[1000] max-h-[calc(500px-1.5rem)] w-72 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Filters
                  </h2>
                  {hasActiveRawFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawSearchTerm("");
                        setRawDateFrom("");
                        setRawDateTo("");
                        setMunicipalityFilter("");
                        setBarangayFilter("");
                        setDistrictFilter("");
                      }}
                      className="text-xs font-semibold text-indigo-700 transition hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Date from
                    <input
                      type="date"
                      value={rawDateFrom}
                      max={rawDateTo || undefined}
                      onChange={(event) => setRawDateFrom(event.target.value)}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Date to
                    <input
                      type="date"
                      value={rawDateTo}
                      min={rawDateFrom || undefined}
                      onChange={(event) => setRawDateTo(event.target.value)}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Municipality
                    <select
                      value={municipalityFilter}
                      onChange={(event) => {
                        setMunicipalityFilter(event.target.value);
                        setBarangayFilter("");
                      }}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">All municipalities</option>
                      {municipalityOptions.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    District
                    <select
                      value={districtFilter}
                      onChange={(event) => {
                        setDistrictFilter(event.target.value);
                        setMunicipalityFilter("");
                        setBarangayFilter("");
                      }}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">All districts</option>
                      {districtOptions.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Barangay
                    <select
                      value={barangayFilter}
                      onChange={(event) => setBarangayFilter(event.target.value)}
                      disabled={!municipalityFilter}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">All barangays</option>
                      {rawBarangayOptions.map((feature) => (
                        <option
                          key={feature.properties.PSGC_CODE}
                          value={String(feature.properties.PSGC_CODE).trim()}
                        >
                          {feature.properties.NAME}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </aside>
            )}
            {activeTab === "processed" && (
              <aside
                aria-label="Filter processed data"
                className="absolute left-3 top-3 z-[1000] max-h-[calc(500px-1.5rem)] w-72 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Filters
                  </h2>
                  {hasActiveProcessedFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setProcessedSearchTerm("");
                        setProcessedDateFrom("");
                        setProcessedDateTo("");
                        setMunicipalityFilter("");
                        setBarangayFilter("");
                        setDistrictFilter("");
                      }}
                      className="text-xs font-semibold text-indigo-700 transition hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Date from
                    <input
                      type="date"
                      value={processedDateFrom}
                      max={processedDateTo || undefined}
                      onChange={(event) =>
                        setProcessedDateFrom(event.target.value)
                      }
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Date to
                    <input
                      type="date"
                      value={processedDateTo}
                      min={processedDateFrom || undefined}
                      onChange={(event) =>
                        setProcessedDateTo(event.target.value)
                      }
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Municipality
                    <select
                      value={municipalityFilter}
                      onChange={(event) => {
                        setMunicipalityFilter(event.target.value);
                        setBarangayFilter("");
                      }}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">All municipalities</option>
                      {municipalityOptions.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    District
                    <select
                      value={districtFilter}
                      onChange={(event) => {
                        setDistrictFilter(event.target.value);
                        setMunicipalityFilter("");
                        setBarangayFilter("");
                      }}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">All districts</option>
                      {districtOptions.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Barangay
                    <select
                      value={barangayFilter}
                      onChange={(event) => setBarangayFilter(event.target.value)}
                      disabled={!municipalityFilter}
                      className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">All barangays</option>
                      {rawBarangayOptions.map((feature) => (
                        <option
                          key={feature.properties.PSGC_CODE}
                          value={String(feature.properties.PSGC_CODE).trim()}
                        >
                          {feature.properties.NAME}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </aside>
            )}
          </div>
        </section>

        <DataTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div hidden={activeTab !== "master"}>
          <>
        <section
          aria-label="Master file records"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          {loading ? (
            <div
              aria-live="polite"
              className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500"
            >
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
              Loading master files…
            </div>
          ) : hasError ? (
            <div role="alert" className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Unable to load master files
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={retryMasterFiles}
                className="mt-4 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Try again
              </button>
            </div>
          ) : masterFiles.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No master files found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Registered file metadata will appear here.
              </p>
            </div>
          ) : filteredMasterFiles.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No matching files
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your search, date, municipality, district, or barangay filters.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-900">
                  Master File Records
                </h2>
                <p className="text-xs text-slate-500">
                  Showing {filteredMasterFiles.length} of {masterFiles.length}{" "}
                  records
                </p>
              </div>
              <div className="max-h-[calc(100vh-230px)] min-h-48 overflow-auto">
                <table className="w-full min-w-max border-separate border-spacing-0 text-left text-xs text-slate-600">
                  <thead className="sticky top-0 z-10 bg-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          scope="col"
                          className="whitespace-nowrap border-b border-slate-700 px-2.5 py-2.5"
                        >
                          {column.label}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="sticky right-0 whitespace-nowrap border-b border-slate-700 bg-slate-800 px-2.5 py-2.5"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMasterFiles.map((file) => (
                      <tr
                        key={file.file_id}
                        className="odd:bg-white even:bg-slate-50/70 hover:bg-indigo-50/70"
                      >
                        {columns.map((column) => {
                          const rawValue =
                            column.key === "extent" && file.extent
                              ? JSON.stringify(file.extent)
                              : file[column.key];
                          const value = formatValue(column.key, rawValue);

                          return (
                            <td
                              key={column.key}
                              className="max-w-48 border-b border-slate-100 px-2.5 py-2 align-top"
                            >
                              <span
                                className="block max-w-48 truncate"
                                title={value == null ? undefined : String(value)}
                              >
                                {!value ? (
                                  <span className="text-slate-300">—</span>
                                ) : (
                                  value
                                )}
                              </span>
                            </td>
                          );
                        })}
                        <td className="sticky right-0 border-b border-slate-100 bg-inherit px-2 py-1.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedFile(file)}
                              aria-label={`More details for ${file.file_name || `file ${file.file_id}`}`}
                              title="View full details"
                              className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-indigo-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                            >
                              <Ellipsis aria-hidden="true" className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const fileName = file.file_name || "";
                                const municipality =
                                  getMunicipalityFromFilename(fileName);
                                const psgc = fileName.substring(0, 10);
                                const barangay = barangayData?.features.find(
                                  (feature) =>
                                    String(feature.properties.PSGC_CODE) === psgc
                                );

                                setSelectedMunicipality(municipality);
                                setSelectedBarangay(barangay);
                              }}
                              aria-label={`Highlight ${file.file_name || `file ${file.file_id}`} on map`}
                              title="Highlight location on map"
                              className="inline-flex size-8 items-center justify-center rounded-md text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                            >
                              <MapPin aria-hidden="true" className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
          </>
        </div>
        <div hidden={activeTab !== "raw"}>
          <RawDataTab
            onHighlightRecord={handleHighlightRawRecord}
            onRecordsLoaded={handleRawRecordsLoaded}
            barangayData={barangayData}
            searchTerm={rawSearchTerm}
            setSearchTerm={setRawSearchTerm}
            dateFrom={rawDateFrom}
            dateTo={rawDateTo}
            municipalityFilter={municipalityFilter}
            barangayFilter={barangayFilter}
            districtFilter={districtFilter}
          />
        </div>
        <div hidden={activeTab !== "processed"}>
          <ProcessedDataTab
            searchTerm={processedSearchTerm}
            dateFrom={processedDateFrom}
            dateTo={processedDateTo}
            municipalityFilter={municipalityFilter}
            barangayFilter={barangayFilter}
            districtFilter={districtFilter}
            districtMunicipalityCodes={districtMunicipalityCodes}
            onNavigateRecord={handleHighlightProcessedRecord}
            onRecordsLoaded={handleProcessedRecordsLoaded}
          />
        </div>
      </div>
      <dialog
        ref={detailsDialogRef}
        aria-labelledby="master-file-details-title"
        onClose={() => setSelectedFile(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl border-0 bg-transparent p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/50"
      >
        {selectedFile && (
          <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  File details
                </p>
                <h2
                  id="master-file-details-title"
                  className="mt-1 truncate text-lg font-semibold text-slate-900"
                >
                  {selectedFile.file_name || `File ${selectedFile.file_id}`}
                </h2>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => detailsDialogRef.current?.close()}
                aria-label="Close file details"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <span aria-hidden="true" className="text-xl leading-none">×</span>
              </button>
            </header>

            
            <dl className="grid gap-x-6 overflow-y-auto px-5 py-4 sm:grid-cols-2">
              {columns.map((column) => {
                const value = formatValue(column.key, selectedFile[column.key]);

                return (
                  <div
                    key={column.key}
                    className="border-b border-slate-100 py-3"
                  >
                    <dt className="text-xs font-semibold text-slate-500">
                      {column.label}
                    </dt>
                    <dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-800">
                      {value || <span className="text-slate-300">—</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <footer className="border-t border-slate-200 px-5 py-3 text-right">
              <button
                type="button"
                onClick={() => detailsDialogRef.current?.close()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Close
              </button>
            </footer>
          </div>
        )}
      </dialog>
    </main>
  );
}

export default MasterFile;