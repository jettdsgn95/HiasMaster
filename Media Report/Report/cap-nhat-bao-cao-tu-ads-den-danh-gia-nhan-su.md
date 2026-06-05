# Cập nhật báo cáo từ phần Ads đến hiện tại

File gốc đang cập nhật:

`C:\Users\ADMIN\Documents\Codex\2026-06-01\files-mentioned-by-the-user-2026\outputs\bao-cao-thang-05-2026-ref-ui.html`

Mục đích: ghi lại các phần đã thêm/chỉnh từ thời điểm tích hợp `Ads-report-thang-5.xlsx` đến bản hiện tại để Dev cập nhật vào file tổng.

## 1. Tích hợp Ads Report

Nguồn dữ liệu:

`C:\Users\ADMIN\Desktop\Ads-report-thang-5.xlsx`

Logic đọc dữ liệu:

- Dùng sheet `Raw Data Report`.
- Chỉ lấy các dòng có `Tên nhóm quảng cáo = All` để tính KPI tổng, tránh đếm trùng các nhóm quảng cáo con.
- Các dòng nhóm quảng cáo con chỉ dùng để biết số lượng adset, không cộng ngân sách.

KPI Ads hiện tại:

- Chiến dịch Ads: `29`
- Nhóm quảng cáo: `55`
- Ngân sách đã chi: `43.722.211 đ`
- Reach: `642.896`
- Impressions: `1.907.822`
- Kết quả: `195.682`
- CPR trung bình: `223 đ`
- CTR TB: `1.96%`
- CPM TB: `22.917 đ`
- Kỳ dữ liệu: `01/05/2026 - 30/05/2026`

## 2. HTML thêm mới cho Ads

Đã thêm tab mới trong thanh tab:

```html
<button class="tab-btn t-red" data-tab="ads">
  <span data-ic="megaphone"></span>
  <span class="tb-txt">Ads Report</span>
  <span class="tbadge" id="tbAds"></span>
</button>
```

Đã thêm panel:

```html
<section class="tab-panel content" id="panel-ads">
  <div class="scard-grid" id="adsStats"></div>
  <div class="controls">
    <div class="f-group" id="adsFilters">
      <button class="fbtn active" data-af="all">Tất cả</button>
      <button class="fbtn" data-af="Lead"><span data-ic="check-circle"></span>Lead</button>
      <button class="fbtn" data-af="Mess"><span data-ic="loader"></span>Mess</button>
      <button class="fbtn" data-af="Tương tác"><span data-ic="trending-up"></span>Tương tác</button>
      <button class="fbtn" data-af="Reach"><span data-ic="users"></span>Reach</button>
    </div>
  </div>
  <div class="workload-overview" id="adsOverview" style="margin:0 0 20px;padding:20px 22px"></div>
  <div class="vc-wrap">
    <table class="vc-table">
      <thead>
        <tr>
          <th>#</th><th>Chiến dịch</th><th>Loại</th><th>Reach</th>
          <th>Impressions</th><th>Kết quả</th><th>Spend</th>
          <th>CPR</th><th>CTR</th><th>CPM</th>
        </tr>
      </thead>
      <tbody id="adsBody"></tbody>
    </table>
  </div>
</section>
```

## 3. Ads Filter

Đã thêm state:

```js
let pSearch='',pFilter='all',allOpen=false,dSearch='',adsFilter='all';
```

Filter hiện có:

- `Tất cả`
- `Lead`
- `Mess`
- `Tương tác`
- `Reach`

Khi bấm filter:

- KPI Ads đổi theo loại đang chọn.
- Thanh tổng quan Ads đổi theo loại đang chọn.
- Bảng chiến dịch đổi theo loại đang chọn.
- Bảng luôn sắp xếp mặc định theo `spend` giảm dần.

Đã remove nhóm sort theo yêu cầu:

- `Sắp theo loại`
- `Chi tiêu`
- `Reach`
- `Kết quả`
- `CTR`

Script event hiện tại:

```js
adsFilters.querySelectorAll('.fbtn').forEach(btn=>btn.addEventListener('click',()=>{
  adsFilters.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  adsFilter=btn.dataset.af;
  renderAds();
}));
```

## 4. Function renderAds

Chức năng:

- Lọc `ADS.campaigns` theo `adsFilter`.
- Recalculate: `spend`, `reach`, `impressions`, `results`, `CPR`, `CTR`, `CPM`.
- Render:
  - `adsStats`
  - `adsOverview`
  - `adsBody`

Lưu ý:

- Nếu `adsFilter = all`, hiển thị toàn bộ 29 campaign.
- Nếu chọn một loại, số liệu KPI và bảng chỉ tính campaign thuộc loại đó.

## 5. Icon mới

Đã thêm icon `megaphone` cho tab Ads:

```js
megaphone:'<path d="M3 11v3a2 2 0 0 0 2 2h2l4 5v-5l8-3V6l-8-3v8H5a2 2 0 0 0-2 2z"/><path d="M19 6a4 4 0 0 1 0 7"/>',
```

Đã thêm icon `award` cho phần đánh giá nhân sự:

```js
award:'<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5"/>',
```

## 6. Đổi nền hero sang vàng

Đã đổi nền đầu báo cáo từ navy sang vàng:

```css
.hero{
  background:linear-gradient(135deg,#F6C343 0%,#FFD86A 52%,#FFF1B8 100%);
}
```

Đồng thời đổi màu chữ hero sang navy/đỏ để dễ đọc:

- `.hero-title`: `var(--navy-dk)`
- `.hero-title .hl`: `var(--red)`
- `.hero-sub`: `rgba(13,13,48,.72)`
- `.period-card`: nền trắng trong suốt, border navy nhạt

## 7. Thêm đánh giá nhân sự

Đã thêm trong tab `Theo PIC`, phía trên danh sách card PIC:

```html
<div class="eval-section">
  <div class="eval-head">
    <div class="eval-ic" data-ic="award"></div>
    <div>
      <div class="eval-title">Đánh giá nhân sự</div>
      <div class="eval-sub">Tập trung vào sự chủ động và mức độ xử lý công việc nhanh nhạy trong tháng 05/2026.</div>
    </div>
  </div>
  <div class="eval-grid" id="picEvalList"></div>
</div>
```

Đã thêm CSS cho:

- `.eval-section`
- `.eval-head`
- `.eval-grid`
- `.eval-card`
- `.eval-card.leader`
- `.eval-line`
- `.eval-pill`
- `.eval-fill`
- `.eval-comment`

## 8. Logic đánh giá nhân sự

Đánh giá được render trong `renderPics()`.

Chỉ số dùng để suy ra nhận xét:

- Tổng task theo PIC
- Số task hoàn thành
- Số task đang làm
- Tỷ lệ hoàn thành
- Tiến độ trung bình
- Số dự án tham gia

Hai tiêu chí hiển thị:

- `Chủ động`
- `Nhanh nhạy`

Các mức nhãn:

- `Xuất sắc`
- `Tốt`
- `Ổn định`
- `Cần bám sát`

## 9. Thùy là Leader

Theo yêu cầu, Thùy được đánh dấu riêng:

- Tag: `Leader`
- Role: `Leader · phối hợp toàn bộ dự án`
- Số dự án hiển thị: dùng `SUMMARY.projectCount`, tức toàn bộ dự án trong báo cáo.
- Card có class `leader` để nền vàng nhạt.

Nhận xét hiện tại cho Thùy:

> Leader điều phối chung, đồng hành cùng tất cả dự án và các bạn khác; cần tiếp tục giữ vai trò kết nối, nhắc tiến độ và hỗ trợ tháo gỡ các điểm nghẽn.

## 10. Ghi chú cho Dev

- Các cập nhật nằm trực tiếp trong file HTML hiện tại, không tách file JS/CSS riêng.
- Cần giữ thứ tự chạy init cuối file:

```js
initKpis();
renderWorkload();
renderProjectStats();
renderProjects();
renderPics();
renderAds();
renderOpen();
renderDetails();
hydrateIcons();
```

- Nếu Dev rebuild từ script gốc, cần đưa lại các thay đổi này vào template, vì một số chỉnh sửa gần đây được patch trực tiếp trên HTML output.
- Riêng Ads data hiện đang nằm trong `const ADS = ...` bên trong HTML. Nếu file tổng có pipeline đọc Excel riêng, nên generate lại `ADS` từ `Ads-report-thang-5.xlsx` bằng logic chỉ lấy dòng `All`.
