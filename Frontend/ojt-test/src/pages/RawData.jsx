
import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { Ellipsis, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

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

function formatValue(key, value) {
  if (value == null || value === "") {
    return "";
  }

  if (key === "creation_date" && typeof value === "string") {
    return value
      .replace(/(?:Z|[+-]\d{2}:?\d{2})$/i, "")
      .replace("T", " ");
  }

  return typeof value === "object"
    ? JSON.stringify(value)
    : String(value);
}

function normalizeMunicipalityName(name) {
  if (!name) return "";

  return name
    .replace(/^City of /, "")
    .replace(/ City$/, "")
    .trim()
    .toLowerCase();
}

function getMunicipalityFromPSGC(pscg) {
  const code = String(pscg ?? "").trim();

  if (!code) return null;

  if (municipalityPSGC[code]) {
    return municipalityPSGC[code];
  }

  const parentPSGC = code.substring(0, 7) + "000";

  return municipalityPSGC[parentPSGC] || null;
}

function getMunicipalityCodeFromPSGC(pscg) {
  const code = String(pscg ?? "").trim();

  if (municipalityPSGC[code]) {
    return code;
  }

  const parentPSGC = code.substring(0, 7) + "000";

  return municipalityPSGC[parentPSGC] ? parentPSGC : null;
}

export default function RawData() {

  const [municipalityData, setMunicipalityData] = useState(null);
const [barangayData, setBarangayData] = useState(null);
const [selectedMunicipality, setSelectedMunicipality] = useState(null);
const [selectedBarangay, setSelectedBarangay] = useState(null);  
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const detailsDialogRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    async function fetchRawData() {
      setLoading(true);
      setError(false);

      try {
        const response = await api.get("/raw-data/");

        if (isActive) {
          setRawData(response.data);
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
  }, [retryCount]);

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
  let isActive = true;

  async function loadGeoJSON() {
    try {
      const [municipalityResponse, barangayResponse] = await Promise.all([
        fetch("/data/municipality.geojson"),
        fetch("/data/barangay.geojson"),
      ]);

      if (!municipalityResponse.ok || !barangayResponse.ok) {
        throw new Error("Unable to load GeoJSON files");
      }

      const [municipality, barangay] = await Promise.all([
        municipalityResponse.json(),
        barangayResponse.json(),
      ]);

      if (isActive) {
        setMunicipalityData(municipality);
        setBarangayData(barangay);
      }
    } catch (err) {
      console.error("Error loading GeoJSON:", err);
    }
  }

  loadGeoJSON();

  return () => {
    isActive = false;
  };
}, []);

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
const hasActiveFilters = Boolean(
  normalizedSearch ||
    dateFrom ||
    dateTo ||
    municipalityFilter ||
    barangayFilter ||
    districtFilter
);


function handleSelectRecord(record) {
  const pscg = String(record.pscg ?? "").trim();

  const municipality = getMunicipalityFromPSGC(pscg);

  const barangay = barangayData?.features.find(
    (feature) =>
      String(feature.properties.PSGC_CODE).trim() === pscg
  );

  setSelectedMunicipality(municipality);
  setSelectedBarangay(barangay || null);

  console.log("Selected PSGC:", pscg);
  console.log("Municipality:", municipality);
  console.log("Barangay:", barangay?.properties.NAME);
}

  return (
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

          if (municipalityName && isSelected) {
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

    {!loading && !error && (
      <section
        aria-label="Filter raw data"
        className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end"
      >
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Search raw data
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search raw data…"
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
          <div className="border-b border-slate-200 px-4 py-3 text-xs text-slate-500">
            Showing {filteredRawData.length} of {rawData.length} raw data
            {rawData.length === 1 ? " record" : " records"}
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
                    className="odd:bg-white even:bg-slate-50/70 hover:bg-indigo-50/70"
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
                          <span
                            className="block max-w-64 truncate"
                            title={value || undefined}
                          >
                            {value || (
                              <span className="text-slate-300">—</span>
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className="sticky right-0 border-b border-slate-100 bg-inherit px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                          aria-label={`More details for raw data record ${record.raw_data_id}`}
                          title="View full details"
                          className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-indigo-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          <Ellipsis aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectRecord(record)}
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
        </>
      )}
    </section>

    </>
  );
}