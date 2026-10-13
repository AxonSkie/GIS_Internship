import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import api from "../services/api";

function MapClickHandler({ setClickedPosition, setLatitude, setLongitude }) {
  useMapEvents({
    click({ latlng }) {
      setClickedPosition([latlng.lat, latlng.lng]);
      setLatitude(String(latlng.lat));
      setLongitude(String(latlng.lng));
    },
  });

  return null;
}

function LocationFocus({ location, markerRefs }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    map.flyTo([latitude, longitude], 17, { duration: 1.2 });

    const marker = markerRefs.current[location.id];
    if (marker) marker.openPopup();
  }, [location, map, markerRefs]);

  return null;
}

function User() {
  const [clickedPosition, setClickedPosition] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [image, setImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const markerRefs = useRef({});

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setUserPosition([coords.latitude, coords.longitude]),
      (error) => console.error("Location error:", error),
    );
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await api.get("/locations/");
        setLocations(response.data);
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      }
    };

    fetchLocations();
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setLatitude("");
    setLongitude("");
    setImage(null);
  };

  const closeForm = () => {
    setShowAddLocation(false);
    resetForm();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!image || isSubmitting) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    formData.append("image", image);

    try {
      const response = await api.post("/locations/", formData);
      const refreshedResponse = await api.get("/locations/");
      const refreshedLocations = refreshedResponse.data;

      setLocations(refreshedLocations);

      const createdLocation =
        refreshedLocations.find(
          (location) => location.id === response.data?.id,
        ) ||
        refreshedLocations.find(
          (location) =>
            location.name === name.trim() &&
            Number(location.latitude) === Number(latitude) &&
            Number(location.longitude) === Number(longitude),
        ) ||
        response.data;

      if (createdLocation?.latitude != null) {
        setSelectedLocation(createdLocation);
      }

      closeForm();
    } catch (error) {
      console.error("Failed to upload location:", error);
      alert("Failed to upload location. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const imageUrl = (filename) =>
    `http://127.0.0.1:8000/uploads/${filename}`;

  const handleLogout = () => {
  localStorage.removeItem("access_token");
  window.location.replace("/login");
};

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Explore
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Community locations
            </h1>
            <p className="mt-2 text-slate-600">
              Explore saved places or add a new location to the map.
            </p>
          </div>

       <div className="flex gap-2">
  <button
    onClick={() => setShowAddLocation(true)}
    className="..."
  >
    Add Location
  </button>

  <button
    onClick={() => window.location.href = "/master-file"}
    className="..."
  >
    Master File
  </button>

  <button
    onClick={handleLogout}
    className="..."
  >
    Log out
  </button>
</div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Map</h2>
              <p className="text-sm text-slate-500">
                Select a saved location below to navigate to its pin.
              </p>
            </div>
            <span className="text-sm text-slate-500">
              {locations.length} {locations.length === 1 ? "location" : "locations"}
            </span>
          </div>

          <div className="h-[420px] w-full sm:h-[520px]">
            <MapContainer
              center={[10.3157, 123.8854]}
              zoom={13}
              className="h-full w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapClickHandler
                setClickedPosition={setClickedPosition}
                setLatitude={setLatitude}
                setLongitude={setLongitude}
              />
              <LocationFocus
                location={selectedLocation}
                markerRefs={markerRefs}
              />

              {locations.map((location) => (
                <Marker
                  key={location.id}
                  position={[
                    Number(location.latitude),
                    Number(location.longitude),
                  ]}
                  ref={(marker) => {
                    if (marker) markerRefs.current[location.id] = marker;
                    else delete markerRefs.current[location.id];
                  }}
                >
                  <Popup>
                    {location.image_filename && (
                      <img
                        src={imageUrl(location.image_filename)}
                        alt={location.name}
                        className="mb-2 h-32 w-full rounded object-cover"
                      />
                    )}
                    <p className="font-bold">{location.name}</p>
                    <p>{location.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {location.latitude}, {location.longitude}
                    </p>
                  </Popup>
                </Marker>
              ))}

              {clickedPosition && (
                <Marker position={clickedPosition}>
                  <Popup>
                    <p className="font-semibold">Selected map point</p>
                    <p>
                      {clickedPosition[0].toFixed(5)},{" "}
                      {clickedPosition[1].toFixed(5)}
                    </p>
                  </Popup>
                </Marker>
              )}

              {userPosition && (
                <Marker position={userPosition}>
                  <Popup>Your current location</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </section>

        {clickedPosition && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-slate-700">
              Selected point:{" "}
              <span className="font-medium">
                {clickedPosition[0].toFixed(5)},{" "}
                {clickedPosition[1].toFixed(5)}
              </span>
              {" — "}use these coordinates in the add-location form.
            </p>
            <button
              type="button"
              onClick={() => setClickedPosition(null)}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              Clear point
            </button>
          </div>
        )}

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-slate-900">
              Saved locations
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Click a location card to focus the map on its pin.
            </p>
          </div>

          {locations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="font-semibold text-slate-800">
                No locations yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add a location to see it listed here.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((location) => {
                const isSelected = selectedLocation?.id === location.id;

                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => setSelectedLocation(location)}
                    aria-pressed={isSelected}
                    className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-100"
                        : "border-slate-200"
                    }`}
                  >
                    {location.image_filename ? (
                      <img
                        src={imageUrl(location.image_filename)}
                        alt={location.name}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-slate-100 text-slate-400">
                        No image
                      </div>
                    )}

                    <div className="p-4">
                      <h3 className="text-lg font-bold text-slate-900">
                        {location.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {location.description}
                      </p>
                      <p className="mt-3 text-sm font-medium text-blue-700">
                        📍 {location.latitude}, {location.longitude}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-slate-400">
                        Click to view on map →
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showAddLocation && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-location-title"
            className="my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2
                  id="add-location-title"
                  className="text-2xl font-bold text-slate-900"
                >
                  Add a location
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the place details and choose its coordinates.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form"
                className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="location-name"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Location name
                </label>
                <input
                  id="location-name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Riverside Park"
                  className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="location-description"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="location-description"
                  required
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What should visitors know?"
                  className="w-full resize-y rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="location-latitude"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Latitude
                  </label>
                  <input
                    id="location-latitude"
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    required
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value)}
                    placeholder="e.g. 10.3157"
                    className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="location-longitude"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Longitude
                  </label>
                  <input
                    id="location-longitude"
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    required
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value)}
                    placeholder="e.g. 123.8854"
                    className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="location-image"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  JPG image
                </label>
                <input
                  id="location-image"
                  type="file"
                  accept="image/jpeg,.jpg,.jpeg"
                  required
                  onChange={(event) =>
                    setImage(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : "Save location"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default User;