#!/bin/bash
# ==========================================================
# Script: e_c1_tls_capture.sh
# Mục đích: Bắt gói tin để chứng minh hiệu quả của TLS (E-C1)
# ==========================================================

mkdir -p EVIDENCE/captures
mkdir -p EVIDENCE/screenshots

echo "==================================================="
echo "BẮT ĐẦU KỊCH BẢN ĐÁNH GIÁ E-C1: TLS TRAFFIC CAPTURE"
echo "==================================================="

echo "[*] Bật tcpdump chạy ngầm để bắt gói tin trên cổng 8000 và 8443..."
# Phải dùng sudo trên Linux để có quyền bắt gói tin
sudo tcpdump -i lo 'port 8000 or port 8443' -w EVIDENCE/captures/capture.pcap &
TCPDUMP_PID=$!

sleep 2

echo ""
echo "[*] 1. Gửi request HTTP không mã hóa (Plaintext)..."
curl -s http://localhost:8000/api/v1/users > /dev/null
echo " -> Đã gửi HTTP Request."

echo ""
echo "[*] 2. Gửi request HTTPS có mã hóa TLS..."
curl -k -s https://localhost:8443/api/v1/users > /dev/null
echo " -> Đã gửi HTTPS Request."

sleep 2

echo ""
echo "[*] Dừng tcpdump..."
sudo kill $TCPDUMP_PID 2>/dev/null

echo "==================================================="
echo "[✅] HOÀN TẤT! Đã lưu file pcap tại: EVIDENCE/captures/capture.pcap"
echo "==================================================="