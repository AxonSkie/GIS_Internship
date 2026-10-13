import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import RawData from "./RawData";
import { Ellipsis, MapPin } from "lucide-react";


import {
  MapContainer,
  TileLayer,
  GeoJSON,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";



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




function formatValue(key, value) {
  if (value == null || value === "") {
    return "";
  }

  if (key === "creation_date" && typeof value === "string") {
    return value.replace(/(?:Z|[+-]\d{2}:?\d{2})$/i, "").replace("T", " ");
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
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

function getMunicipalityCodeFromPSGC(psgc) {
  const code = String(psgc ?? "").trim();

  if (municipalityPSGC[code]) {
    return code;
  }

  const parentPSGC = code.substring(0, 7) + "000";

  return municipalityPSGC[parentPSGC] ? parentPSGC : null;
}



function MasterFile() {
  const [activeTab, setActiveTab] = useState("master");
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);  
  const [masterFiles, setMasterFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const detailsDialogRef = useRef(null);
  const [municipalityData, setMunicipalityData] = useState(null);
const [barangayData, setBarangayData] = useState(null);

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
          {activeTab === "master" && !loading && !hasError && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              {filteredMasterFiles.length} of {masterFiles.length} files
            </span>
          )}
        </header>

        <nav className="mb-5 flex gap-2 border-b border-slate-200" aria-label="Data tables">
          <button
            type="button"
            onClick={() => setActiveTab("master")}
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
            onClick={() => setActiveTab("raw")}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "raw"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Raw Data
          </button>
        </nav>

        {activeTab === "master" ? (
          <>
       <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
<MapContainer
  center={[10.63, 122.96]}
  zoom={12}
  className="h-[500px] w-full"
>
  <TileLayer
    attribution="&copy; OpenStreetMap contributors"
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />

  {municipalityData && (
  <GeoJSON
    key={selectedMunicipality || "none"}
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
      };
    }}
    onEachFeature={(feature, layer) => {
      const municipalityName = feature.properties?.LGU;
      const isSelected =
        normalizeMunicipalityName(municipalityName) ===
        normalizeMunicipalityName(selectedMunicipality);

      if (municipalityName && selectedMunicipality && isSelected) {
        layer.bindTooltip(municipalityName, {
          permanent: true,
          direction: "center",
          className: "map-feature-label",
        });
      }
    }}
  />
)}

{barangayData && (
  <>
    <GeoJSON
      data={barangayData}
      style={{
        color: "#2d2df9",
        weight: 1,
        fillColor: "#470404",
        fillOpacity: 0.05,
      }}
    />

    {selectedBarangay && (
      <GeoJSON
        key={`selected-${selectedBarangay.properties.PSGC_CODE}`}
        data={selectedBarangay}
        style={{
          color: "#e9ff25",
          weight: 4,
          fillColor: "#35ff57",
          fillOpacity: 0.35,
        }}
        onEachFeature={(feature, layer) => {
          const barangayName = feature.properties?.NAME;

          if (barangayName) {
            layer.bindTooltip(barangayName, {
              permanent: true,
              direction: "center",
              className: "barangay-feature-label",
            });
          }
        }}
      />
    )}
  </>
)}
</MapContainer>
</section>

        {!loading && !hasError && (
          <section
            aria-label="Filter master files"
            className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end"
          >
            <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
              Search files
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search file metadata…"
                className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
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
                className="h-9 min-w-44 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                className="h-9 min-w-40 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
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
                className="h-9 min-w-44 rounded-lg border border-slate-300 px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
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
                className="h-9 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Clear filters
              </button>
            )}
          </section>
        )}

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
          )}
        </section>
          </>
                ) : (
          <RawData />
        )}
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