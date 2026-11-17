import React, { useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  Camera,
  Edit3,
  FileCheck2,
  MapPin,
  Navigation,
  Plus,
  Printer,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import { ProductionBatch, SchoolDelivery, SchoolRecord } from '../types/erp';
import { formatTanggalIndonesia, getJakartaTodayIso } from '../utils/calculations';

interface SchoolMarkerProps {
  school: SchoolRecord;
  isSelected: boolean;
  onSelect: (school: SchoolRecord) => void;
  onCloseInfo: () => void;
}

const SchoolMarkerItem: React.FC<SchoolMarkerProps> = ({
  school,
  isSelected,
  onSelect,
  onCloseInfo,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: school.lat, lng: school.lng }}
        title={school.schoolName}
        onClick={() => onSelect(school)}
      >
        <Pin
          background={school.partnershipStatus === 'Aktif' ? '#047857' : '#d97706'}
          borderColor={'#064e3b'}
          glyphColor={'#ffffff'}
        />
      </AdvancedMarker>
      {isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={260} onCloseClick={onCloseInfo}>
          <div className="p-1 text-xs text-slate-900 space-y-1">
            <div className="font-bold text-emerald-900">{school.schoolName}</div>
            <div className="text-slate-600">NPSN: {school.npsn}</div>
            <div className="text-slate-600">{school.address}</div>
            <div className="font-semibold text-slate-800">
              Kepala Sekolah: {school.principalName}
            </div>
            <div className="font-mono tabular-nums text-emerald-700 font-bold">
              {school.studentCount} Siswa · {school.classCount} Kelas
            </div>
            <div className="text-slate-500">Jadwal: {school.deliverySchedule}</div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface SekolahRakyatModuleProps {
  ownerId: string;
  schools: SchoolRecord[];
  deliveries: SchoolDelivery[];
  productionBatches?: ProductionBatch[];
  onSaveSchool: (school: SchoolRecord) => Promise<void>;
  onDeleteSchool: (id: string) => Promise<void>;
  onSaveDelivery: (delivery: SchoolDelivery) => Promise<void>;
  onDeleteDelivery: (id: string) => Promise<void>;
}

export const SekolahRakyatModule: React.FC<SekolahRakyatModuleProps> = ({
  ownerId,
  schools,
  deliveries,
  productionBatches = [],
  onSaveSchool,
  onDeleteSchool,
  onSaveDelivery,
  onDeleteDelivery,
}) => {
  const todayIso = getJakartaTodayIso();
  const [activeSubTab, setActiveSubTab] = useState<'schools' | 'deliveries' | 'lpj'>('schools');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<SchoolRecord | null>(schools[0] || null);
  const [feedback, setFeedback] = useState('');

  // Add / Edit School Form State
  const [showSchoolForm, setShowSchoolForm] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [npsn, setNpsn] = useState('');
  const [address, setAddress] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [lat, setLat] = useState(-6.2088);
  const [lng, setLng] = useState(106.8456);
  const [studentCount, setStudentCount] = useState(320);
  const [classCount, setClassCount] = useState(10);
  const [deliverySchedule, setDeliverySchedule] = useState('Senin - Jumat, 07:30 - 08:15 WIB');
  const [partnershipStatus, setPartnershipStatus] = useState<'Aktif' | 'Evaluasi' | 'Nonaktif'>('Aktif');

  // Add Delivery Form State
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [delDate, setDelDate] = useState(todayIso);
  const [delSchoolId, setDelSchoolId] = useState(schools[0]?.id || '');
  const [delBatchId, setDelBatchId] = useState('');
  const [delMenuPkg, setDelMenuPkg] = useState('Paket Gizi Terpadu Ikan Fillet & Susu UHT');
  const [delPortionsPlanned, setDelPortionsPlanned] = useState(schools[0]?.studentCount || 420);
  const [delPortions, setDelPortions] = useState(schools[0]?.studentCount || 420);
  const [delCourier, setDelCourier] = useState('Armada 01 - Agus Salim (B 9124 SCA)');
  const [delDepart, setDelDepart] = useState('06:55 WIB');
  const [delArrive, setDelArrive] = useState('07:30 WIB');
  const [delRecipient, setDelRecipient] = useState(schools[0]?.principalName || '');
  const [delProofNote, setDelProofNote] = useState('');
  const [delProofUrl, setDelProofUrl] = useState('');
  const [delStatus, setDelStatus] = useState<SchoolDelivery['status']>('Dalam Pengiriman');

  // Delivery History Filter
  const [delSearch, setDelSearch] = useState('');
  const [delStatusFilter, setDelStatusFilter] = useState<string>('Semua');

  const mapsApiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !npsn.trim() || !address.trim() || !principalName.trim()) {
      notify('Mohon lengkapi nama sekolah, NPSN, alamat, dan nama kepala sekolah.');
      return;
    }
    const newSchool: SchoolRecord = {
      id: editingSchoolId || `sch-${Date.now()}`,
      ownerId,
      schoolName: schoolName.trim(),
      npsn: npsn.trim(),
      address: address.trim(),
      principalName: principalName.trim(),
      contactPhone: contactPhone.trim() || '08120000000',
      lat: Number(lat),
      lng: Number(lng),
      studentCount: Number(studentCount),
      classCount: Number(classCount),
      deliverySchedule: deliverySchedule.trim(),
      partnershipStatus,
    };
    try {
      await onSaveSchool(newSchool);
      setSelectedSchool(newSchool);
      setShowSchoolForm(false);
      setEditingSchoolId(null);
      setSchoolName('');
      setNpsn('');
      setAddress('');
      setPrincipalName('');
      notify('Data Sekolah Rakyat & titik koordinat GPS berhasil disimpan.');
    } catch {
      notify('Gagal menyimpan data sekolah ke server.');
    }
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSchool = schools.find((s) => s.id === delSchoolId) || schools[0];
    if (!targetSchool) {
      notify('Tambahkan data sekolah terlebih dahulu.');
      return;
    }
    const newDel: SchoolDelivery = {
      id: `del-${Date.now()}`,
      ownerId,
      deliveryDate: delDate,
      schoolId: targetSchool.id,
      schoolName: targetSchool.schoolName,
      menuPackage: delMenuPkg.trim(),
      portionsDelivered: Number(delPortions),
      portionsPlanned: Number(delPortionsPlanned) || Number(delPortions),
      productionBatchId: delBatchId || undefined,
      courierName: delCourier.trim(),
      departureTime: delDepart.trim(),
      arrivalTime: delArrive.trim(),
      recipientName: delRecipient.trim() || targetSchool.principalName,
      handoverProofNote: delProofNote.trim().slice(0, 400) || undefined,
      handoverProofUrl: delProofUrl.trim().slice(0, 500) || undefined,
      status: delStatus,
    };
    try {
      await onSaveDelivery(newDel);
      setShowDeliveryForm(false);
      setDelProofNote('');
      setDelProofUrl('');
      notify(`Pengiriman makanan ke ${targetSchool.schoolName} berhasil dicatat.`);
    } catch {
      notify('Gagal mencatat pengiriman sekolah ke server.');
    }
  };

  const filteredSchools = schools.filter(
    (s) =>
      !searchQuery ||
      s.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.npsn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.principalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDeliveries = deliveries.filter((d) => {
    const matchStatus = delStatusFilter === 'Semua' || d.status === delStatusFilter;
    const q = delSearch.trim().toLowerCase();
    const matchQ =
      !q ||
      d.schoolName.toLowerCase().includes(q) ||
      d.courierName.toLowerCase().includes(q) ||
      d.recipientName.toLowerCase().includes(q) ||
      d.menuPackage.toLowerCase().includes(q);
    return matchStatus && matchQ;
  });

  const totalStudents = schools.reduce((acc, s) => acc + s.studentCount, 0);
  const totalClasses = schools.reduce((acc, s) => acc + s.classCount, 0);
  const totalPortionsDistributed = deliveries
    .filter((d) => d.status !== 'Dibatalkan')
    .reduce((acc, d) => acc + d.portionsDelivered, 0);

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Modul 2 — Manajemen Makanan Sekolah Rakyat & Pemetaan GPS
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Modul Terpisah Program Gizi Sekolah Rakyat · Pemetaan Titik Koordinat GPS · Distribusi & LPJ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1 w-fit" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'schools'}
            onClick={() => setActiveSubTab('schools')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'schools'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>1. Data Sekolah & Peta Lokasi ({schools.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'deliveries'}
            onClick={() => setActiveSubTab('deliveries')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'deliveries'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>2. Jadwal & Monitoring Pengiriman ({deliveries.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'lpj'}
            onClick={() => setActiveSubTab('lpj')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'lpj'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>3. Laporan Pertanggungjawaban (LPJ)</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-500">Sekolah Rakyat Mitra Aktif</span>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
            {schools.filter((s) => s.partnershipStatus === 'Aktif').length} Sekolah
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-500">Total Siswa Penerima Manfaat</span>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-700">
            {totalStudents.toLocaleString('id-ID')} Siswa
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-500">Total Rombongan Belajar</span>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
            {totalClasses.toLocaleString('id-ID')} Kelas
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-500">Realisasi Distribusi Harian</span>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
            {totalPortionsDistributed.toLocaleString('id-ID')} Porsi
          </div>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
          {feedback}
        </div>
      )}

      {/* SUB-TAB 1: DATA SEKOLAH & PETA GPS */}
      {activeSubTab === 'schools' && (
        <div className="space-y-5">
          {/* Interactive Google Maps Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-700" />
                  <span>Peta Lokasi Seluruh Sekolah Rakyat yang Dilayani (Google Maps GPS)</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Klik marker sekolah pada peta atau baris tabel di bawah untuk melihat detail koordinat GPS, NPSN, dan kuota siswa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSchoolForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Data Sekolah Rakyat</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              <div className="lg:col-span-2 h-[400px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative">
                {mapsApiKey ? (
                  <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="id" region="ID">
                    <GoogleMap
                      mapId="DEMO_MAP_ID"
                      defaultZoom={12}
                      defaultCenter={{ lat: -6.2015, lng: 106.8495 }}
                      gestureHandling="cooperative"
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      className="h-full w-full"
                    >
                      {schools.map((sch) => (
                        <SchoolMarkerItem
                          key={sch.id}
                          school={sch}
                          isSelected={selectedSchool?.id === sch.id}
                          onSelect={(s) => setSelectedSchool(s)}
                          onCloseInfo={() => setSelectedSchool(null)}
                        />
                      ))}
                    </GoogleMap>
                  </APIProvider>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-xs text-slate-600">
                    <Navigation className="h-8 w-8 text-emerald-700 mb-2" />
                    <p className="font-bold text-slate-900">Peta GPS Sekolah Rakyat Siap</p>
                    <p>Pilih sekolah di samping untuk menginspeksi titik koordinat Lat/Lng.</p>
                  </div>
                )}
              </div>

              {/* Active School Inspector Panel */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2">
                    Detail Titik Koordinat & Kuota Sekolah
                  </div>
                  {selectedSchool ? (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 block">Nama Sekolah Rakyat</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {selectedSchool.schoolName}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 block">NPSN</span>
                          <span className="font-mono tabular-nums font-semibold text-slate-800">
                            {selectedSchool.npsn}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Status Kerja Sama</span>
                          <span className="font-semibold text-emerald-700">
                            {selectedSchool.partnershipStatus}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Alamat Sekolah</span>
                        <span className="text-slate-700">{selectedSchool.address}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Kepala Sekolah & Kontak</span>
                        <span className="font-semibold text-slate-800">
                          {selectedSchool.principalName}
                        </span>
                        <span className="block font-mono tabular-nums text-slate-600">
                          Telp/WA: {selectedSchool.contactPhone}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-2.5 border border-slate-200">
                        <div>
                          <span className="text-slate-400 block">Latitude</span>
                          <span className="font-mono tabular-nums font-bold text-slate-900">
                            {selectedSchool.lat}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Longitude</span>
                          <span className="font-mono tabular-nums font-bold text-slate-900">
                            {selectedSchool.lng}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-emerald-950 text-white p-2.5">
                        <div>
                          <span className="text-emerald-300 block">Jumlah Siswa</span>
                          <span className="font-mono tabular-nums font-bold text-sm">
                            {selectedSchool.studentCount} Siswa
                          </span>
                        </div>
                        <div>
                          <span className="text-emerald-300 block">Jumlah Kelas</span>
                          <span className="font-mono tabular-nums font-bold text-sm">
                            {selectedSchool.classCount} Rombel
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Jadwal Pengiriman Rutin</span>
                        <span className="font-medium text-slate-800">
                          {selectedSchool.deliverySchedule}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Klik salah satu sekolah untuk melihat rincian GPS dan kuota porsi.
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 mt-3">
                  <p className="text-[11px] text-slate-500">
                    Seluruh titik koordinat terhubung dengan rute armada distribusi dapur sentral.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Add School Form */}
          {showSchoolForm && (
            <form
              onSubmit={handleSchoolSubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h3 className="text-sm font-bold text-slate-900">
                {editingSchoolId
                  ? 'Perbarui Data Sekolah Rakyat Mitra'
                  : 'Formulir Registrasi Sekolah Rakyat Mitra Baru'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="sch-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Sekolah Rakyat
                  </label>
                  <input
                    id="sch-name"
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Contoh: Sekolah Rakyat Nusantara 05 Cempaka Putih"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-npsn" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Pokok Sekolah Nasional (NPSN)
                  </label>
                  <input
                    id="sch-npsn"
                    type="text"
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    placeholder="2010xxxx"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-head" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Kepala Sekolah
                  </label>
                  <input
                    id="sch-head"
                    type="text"
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    placeholder="Nama lengkap & gelar"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Kontak / WhatsApp Sekolah
                  </label>
                  <input
                    id="sch-phone"
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="sch-addr" className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat Lengkap Sekolah
                  </label>
                  <input
                    id="sch-addr"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Jalan, Nomor, Kelurahan, Kecamatan, Kota..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-lat" className="block text-xs font-semibold text-slate-700 mb-1">
                    Koordinat GPS Latitude
                  </label>
                  <input
                    id="sch-lat"
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-lng" className="block text-xs font-semibold text-slate-700 mb-1">
                    Koordinat GPS Longitude
                  </label>
                  <input
                    id="sch-lng"
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-students" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Siswa Penerima Makanan
                  </label>
                  <input
                    id="sch-students"
                    type="number"
                    min={1}
                    value={studentCount}
                    onChange={(e) => setStudentCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-classes" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Kelas (Rombel)
                  </label>
                  <input
                    id="sch-classes"
                    type="number"
                    min={1}
                    value={classCount}
                    onChange={(e) => setClassCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-sched" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jadwal Pengiriman
                  </label>
                  <input
                    id="sch-sched"
                    type="text"
                    value={deliverySchedule}
                    onChange={(e) => setDeliverySchedule(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="sch-status" className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Kerja Sama
                  </label>
                  <select
                    id="sch-status"
                    value={partnershipStatus}
                    onChange={(e) =>
                      setPartnershipStatus(e.target.value as 'Aktif' | 'Evaluasi' | 'Nonaktif')
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Evaluasi">Evaluasi</option>
                    <option value="Nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSchoolForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Simpan Data Sekolah
                </button>
              </div>
            </form>
          )}

          {/* Schools Directory Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">
                Tabel Direktori Sekolah Rakyat Mitra ({filteredSchools.length})
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
                <input
                  type="text"
                  aria-label="Cari sekolah rakyat"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama sekolah, NPSN, kepsek..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-4 font-semibold">Nama Sekolah & NPSN</th>
                    <th className="py-3 px-4 font-semibold">Kepala Sekolah & Kontak</th>
                    <th className="py-3 px-4 font-semibold">Titik Koordinat GPS</th>
                    <th className="py-3 px-4 font-semibold text-right">Siswa / Kelas</th>
                    <th className="py-3 px-4 font-semibold">Jadwal Pengiriman</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchools.map((sch) => (
                    <tr
                      key={sch.id}
                      onClick={() => setSelectedSchool(sch)}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selectedSchool?.id === sch.id ? 'bg-emerald-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{sch.schoolName}</div>
                        <div className="font-mono tabular-nums text-slate-500">
                          NPSN: {sch.npsn} · {sch.address}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{sch.principalName}</div>
                        <div className="font-mono tabular-nums text-slate-500">{sch.contactPhone}</div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                        {sch.lat}, {sch.lng}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-bold text-slate-900">{sch.studentCount} siswa</div>
                        <div className="text-slate-500">{sch.classCount} kelas</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{sch.deliverySchedule}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        {sch.partnershipStatus}
                      </td>
                      <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSchoolId(sch.id);
                            setSchoolName(sch.schoolName);
                            setNpsn(sch.npsn);
                            setAddress(sch.address);
                            setPrincipalName(sch.principalName);
                            setContactPhone(sch.contactPhone);
                            setLat(sch.lat);
                            setLng(sch.lng);
                            setStudentCount(sch.studentCount);
                            setClassCount(sch.classCount);
                            setDeliverySchedule(sch.deliverySchedule);
                            setPartnershipStatus(sch.partnershipStatus);
                            setShowSchoolForm(true);
                          }}
                          aria-label={`Edit ${sch.schoolName}`}
                          className="text-slate-700 hover:text-emerald-700 font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSchool(sch.id);
                          }}
                          aria-label={`Hapus ${sch.schoolName}`}
                          className="text-red-600 hover:text-red-800 font-semibold inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSchools.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-500">
                        Belum ada data sekolah mitra Sekolah Rakyat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DISTRIBUSI, PRODUKSI & RIWAYAT PENGIRIMAN */}
      {activeSubTab === 'deliveries' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Monitoring &amp; Riwayat Distribusi Sekolah Rakyat
              </h2>
              <p className="text-xs text-slate-500">
                Terhubung ke batch produksi dapur, waktu berangkat/tiba, nama penerima, dan bukti serah terima.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!delSchoolId && schools[0]) {
                  setDelSchoolId(schools[0].id);
                  setDelPortions(schools[0].studentCount);
                  setDelPortionsPlanned(schools[0].studentCount);
                  setDelRecipient(schools[0].principalName);
                }
                setShowDeliveryForm((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Catat Pengiriman Sekolah</span>
            </button>
          </div>

          {showDeliveryForm && (
            <form
              onSubmit={handleDeliverySubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h3 className="text-sm font-bold text-slate-900">
                Input Surat Jalan &amp; Pengiriman Makanan Sekolah Rakyat
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="del-date" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pengiriman
                  </label>
                  <input
                    id="del-date"
                    type="date"
                    value={delDate}
                    onChange={(e) => setDelDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="del-school" className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilih Sekolah Tujuan
                  </label>
                  <select
                    id="del-school"
                    value={delSchoolId}
                    onChange={(e) => {
                      setDelSchoolId(e.target.value);
                      const found = schools.find((s) => s.id === e.target.value);
                      if (found) {
                        setDelPortions(found.studentCount);
                        setDelPortionsPlanned(found.studentCount);
                        setDelRecipient(found.principalName);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.schoolName} ({s.studentCount} siswa)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="del-batch" className="block text-xs font-semibold text-slate-700 mb-1">
                    Batch Produksi Dapur Terkait
                  </label>
                  <select
                    id="del-batch"
                    value={delBatchId}
                    onChange={(e) => {
                      setDelBatchId(e.target.value);
                      const batch = productionBatches.find((b) => b.id === e.target.value);
                      if (batch) {
                        setDelMenuPkg(batch.menuName);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">-- Pilih Batch Produksi (Opsional) --</option>
                    {productionBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {formatTanggalIndonesia(b.productionDate)} · {b.menuName} ({b.portions} pax)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="del-planned" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kuota Direncanakan (Porsi)
                  </label>
                  <input
                    id="del-planned"
                    type="number"
                    min={1}
                    value={delPortionsPlanned}
                    onChange={(e) => setDelPortionsPlanned(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="del-portions" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Porsi Dikirim
                  </label>
                  <input
                    id="del-portions"
                    type="number"
                    min={1}
                    value={delPortions}
                    onChange={(e) => setDelPortions(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="del-menu" className="block text-xs font-semibold text-slate-700 mb-1">
                    Menu Paket Gizi
                  </label>
                  <input
                    id="del-menu"
                    type="text"
                    value={delMenuPkg}
                    onChange={(e) => setDelMenuPkg(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="del-courier" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Petugas &amp; Armada Pengiriman
                  </label>
                  <input
                    id="del-courier"
                    type="text"
                    value={delCourier}
                    onChange={(e) => setDelCourier(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="del-depart" className="block text-xs font-semibold text-slate-700 mb-1">
                    Waktu Keberangkatan
                  </label>
                  <input
                    id="del-depart"
                    type="text"
                    value={delDepart}
                    onChange={(e) => setDelDepart(e.target.value)}
                    placeholder="06:55 WIB"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="del-arrive" className="block text-xs font-semibold text-slate-700 mb-1">
                    Waktu Penerimaan / Estimasi Tiba
                  </label>
                  <input
                    id="del-arrive"
                    type="text"
                    value={delArrive}
                    onChange={(e) => setDelArrive(e.target.value)}
                    placeholder="07:30 WIB"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="del-recipient" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Penerima di Sekolah
                  </label>
                  <input
                    id="del-recipient"
                    type="text"
                    value={delRecipient}
                    onChange={(e) => setDelRecipient(e.target.value)}
                    placeholder="Kepala Sekolah / Guru Piket"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="del-status" className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Distribusi
                  </label>
                  <select
                    id="del-status"
                    value={delStatus}
                    onChange={(e) => setDelStatus(e.target.value as SchoolDelivery['status'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Persiapan">Persiapan</option>
                    <option value="Dalam Pengiriman">Dalam Pengiriman</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Dibatalkan">Dibatalkan</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="del-proof-url" className="block text-xs font-semibold text-slate-700 mb-1">
                    Referensi / URL Foto Serah Terima
                  </label>
                  <input
                    id="del-proof-url"
                    type="text"
                    value={delProofUrl}
                    onChange={(e) => setDelProofUrl(e.target.value)}
                    placeholder="https://... atau No. BAST"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="del-proof-note" className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Berita Acara Serah Terima (Bukti Pengiriman)
                </label>
                <input
                  id="del-proof-note"
                  type="text"
                  value={delProofNote}
                  onChange={(e) => setDelProofNote(e.target.value)}
                  placeholder="Contoh: Diterima lengkap 420 porsi, suhu hangat, ditandatangani Kepala Sekolah."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeliveryForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
                >
                  Simpan Surat Jalan Distribusi
                </button>
              </div>
            </form>
          )}

          {/* Riwayat Distribusi Filter Bar */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="font-bold text-xs text-slate-900">
                Riwayat Distribusi &amp; Bukti Serah Terima ({filteredDeliveries.length})
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2" />
                  <input
                    type="text"
                    value={delSearch}
                    onChange={(e) => setDelSearch(e.target.value)}
                    placeholder="Cari sekolah, kurir, penerima..."
                    aria-label="Cari riwayat distribusi"
                    className="rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <select
                  value={delStatusFilter}
                  onChange={(e) => setDelStatusFilter(e.target.value)}
                  aria-label="Filter status distribusi"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="Persiapan">Persiapan</option>
                  <option value="Dalam Pengiriman">Dalam Pengiriman</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Dibatalkan">Dibatalkan</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-4 font-semibold">Tanggal</th>
                    <th className="py-3 px-4 font-semibold">Sekolah Rakyat &amp; Penerima</th>
                    <th className="py-3 px-4 font-semibold">Menu &amp; Produksi</th>
                    <th className="py-3 px-4 font-semibold text-right">Porsi</th>
                    <th className="py-3 px-4 font-semibold">Petugas &amp; Waktu</th>
                    <th className="py-3 px-4 font-semibold">Bukti Serah Terima</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeliveries.map((del) => {
                    const linkedBatch = del.productionBatchId
                      ? productionBatches.find((b) => b.id === del.productionBatchId)
                      : undefined;
                    return (
                      <tr key={del.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {formatTanggalIndonesia(del.deliveryDate)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{del.schoolName}</div>
                          <div className="text-slate-500">Penerima: {del.recipientName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{del.menuPackage}</div>
                          {linkedBatch && (
                            <div className="text-[11px] text-emerald-700">
                              Batch: {linkedBatch.officerName} ({linkedBatch.status})
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {del.portionsDelivered} pax
                          {del.portionsPlanned && del.portionsPlanned !== del.portionsDelivered && (
                            <div className="text-[11px] font-normal text-slate-500">
                              Rencana: {del.portionsPlanned}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{del.courierName}</div>
                          <div className="font-mono tabular-nums text-slate-500">
                            Berangkat {del.departureTime} · Terima {del.arrivalTime}
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-[200px]">
                          {del.handoverProofNote || del.handoverProofUrl ? (
                            <div className="space-y-0.5">
                              {del.handoverProofNote && (
                                <div className="text-slate-700">{del.handoverProofNote}</div>
                              )}
                              {del.handoverProofUrl && (
                                <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold break-all">
                                  <Camera className="h-3 w-3 shrink-0" />
                                  <span>{del.handoverProofUrl}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Belum dilampirkan</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            aria-label={`Ubah status pengiriman ${del.schoolName}`}
                            value={del.status}
                            onChange={async (e) => {
                              try {
                                await onSaveDelivery({
                                  ...del,
                                  status: e.target.value as SchoolDelivery['status'],
                                });
                                notify(`Status distribusi ke ${del.schoolName} diperbarui.`);
                              } catch {
                                notify('Gagal memperbarui status distribusi ke server.');
                              }
                            }}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                          >
                            <option value="Persiapan">Persiapan</option>
                            <option value="Dalam Pengiriman">Dalam Pengiriman</option>
                            <option value="Selesai">Selesai</option>
                            <option value="Dibatalkan">Dibatalkan</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteDelivery(del.id)}
                            aria-label={`Hapus pengiriman ${del.schoolName}`}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDeliveries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 px-4 text-center text-xs text-slate-500">
                        Belum ada catatan riwayat distribusi sekolah yang sesuai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: LAPORAN PERTANGGUNGJAWABAN (LPJ) */}
      {activeSubTab === 'lpj' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                BERITA ACARA & LAPORAN PERTANGGUNGJAWABAN (LPJ) PENYEDIAAN MAKANAN SEKOLAH RAKYAT
              </h2>
              <p className="text-xs text-slate-500">
                Rekapitulasi Resmi Realisasi Porsi, Kepatuhan Gizi, dan Tanda Terima Kepala Sekolah
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Dokumen LPJ Resmi</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500 block">Penyelenggara Dapur Sentral:</span>
              <span className="font-bold text-slate-900">
                Smart Catering &amp; Sekolah Rakyat Management System
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Standar Mutu &amp; Higienitas:</span>
              <span className="font-bold text-emerald-800">
                Lolos QC Ahli Gizi (protein hewani, sayur, buah &amp; susu UHT)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Realisasi Tersalurkan:</span>
              <span className="font-mono tabular-nums font-bold text-slate-900">
                {totalPortionsDistributed.toLocaleString('id-ID')} Porsi Tersalurkan
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">NPSN</th>
                  <th className="py-2.5 px-3 font-semibold">Nama Sekolah Rakyat</th>
                  <th className="py-2.5 px-3 font-semibold">Kepala Sekolah Penanggung Jawab</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Kuota Siswa</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Realisasi Porsi</th>
                  <th className="py-2.5 px-3 font-semibold">Status Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schools.map((sch) => {
                  const schDeliveries = deliveries.filter(
                    (d) => d.schoolId === sch.id && d.status !== 'Dibatalkan'
                  );
                  const realisasi = schDeliveries.reduce(
                    (sum, d) => sum + d.portionsDelivered,
                    0
                  );
                  const completedCount = schDeliveries.filter(
                    (d) => d.status === 'Selesai'
                  ).length;
                  return (
                    <tr key={sch.id}>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                        {sch.npsn}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{sch.schoolName}</td>
                      <td className="py-2.5 px-3 text-slate-700">{sch.principalName}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {sch.studentCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {realisasi.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {completedCount > 0
                          ? `Terverifikasi · ${completedCount} Pengiriman Selesai`
                          : schDeliveries.length > 0
                          ? `${schDeliveries.length} Pengiriman Berjalan`
                          : 'Belum Ada Distribusi'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
