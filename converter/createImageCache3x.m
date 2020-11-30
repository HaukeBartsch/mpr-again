
cd('/Users/hauke/src/mpr-again/converter');
%%addpath('/Users/hauke/src/mpr-again/converter/niftimatlib-1.2/matlab');
addpath('/usr/local/fsl/etc/matlab/');

% we might be able to resize the volume
% fslreorient2std Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70.nii.gz
% flirt -in Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70.nii.gz \
% -ref Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70.nii.gz \
% -applyisoxfm 0.5 -nosearch -out Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70_512x512x512.nii.gz 

%data = read_avw('../data/Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70_512x512x512.nii');
data = read_avw('../data/Landman_1399_20110819_366886505_501_WIP_T2_TRA_GRASE_SENSE_T2_TRA_GRASE_512x512x512.nii');
% Unit voxel size? Need to do the right thing here
data = squeeze(data(:,:,:,1));
data = imresize3(data,[512,512,512]);
% this will flip left and right, rot180 would be better
imagesc(flipud(data(:,:,200)')); axis equal; axis off;

d = size(data);
numImages = ceil(sqrt(d(3)));
% we will have a single image with ceil(sqrt(512*512*512))
d2d = [numImages * max(d(1),d(2)), numImages * max(d(1),d(2))];
data2d = uint16(zeros(d2d));

% one problem is HDR - we got 16bit data but we only have 8 bit display
% in a jpeg we have 8bit only
h = 1; w = 1;
for i=1:d(3)
   im = squeeze(data(:,:,i));
   data2d(w:(w+d(1)-1), h:(h+d(2)-1)) = rot90(im,1);
   if (w+d(1)-1) >= d2d(1),
       w = 1;
       h = h + d(2);
   else
       w = w + d(1);
   end
end
data2d8bit = uint8(double(data2d)/double(max(max(data2d))) * (2^8-1));
data2d16bit = uint16(double(data2d)/double(max(max(data2d))) * (2^16-1));
imwrite(data2d16bit, 'T2Axial.png', 'PNG', 'BitDepth', 16);
%imwrite(data2d, 'T1Axial.jp2', 'jp2', 'Mode', 'lossy', 'CompressionRatio', 3);
imwrite(data2d8bit, 'T2Axial.jpg', 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 75);

h = 1; w = 1;
for i=1:d(2)
   im = squeeze(data(:,i,:));
   data2d(w:(w+d(1)-1), h:(h+d(2)-1)) = rot90(im,1);
   if (w+d(1)-1) >= d2d(1),
       w = 1;
       h = h + d(2);
   else
       w = w + d(1);
   end
end
data2d8bit = uint8(double(data2d)/double(max(max(data2d))) * (2^8-1));
data2d16bit = uint16(double(data2d)/double(max(max(data2d))) * (2^16-1));
imwrite(data2d16bit, 'T2Coronal.png', 'PNG', 'BitDepth', 16);
imwrite(data2d8bit, 'T2Coronal.jpg', 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 75);

h = 1; w = 1;
for i=1:d(1)
   im = squeeze(data(i,:,:));
   data2d(w:(w+d(1)-1), h:(h+d(2)-1)) = rot90(im,1);
   if (w+d(1)-1) >= d2d(1),
       w = 1;
       h = h + d(2);
   else
       w = w + d(1);
   end
end
data2d8bit = uint8(double(data2d)/double(max(max(data2d))) * (2^8-1));
data2d16bit = uint16(double(data2d)/double(max(max(data2d))) * (2^16-1));
imwrite(data2d16bit, 'T2Sagittal.png', 'PNG', 'BitDepth', 16);
imwrite(data2d8bit, 'T2Sagittal.jpg', 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 75);

% imwrite(data2d, 'output.jpg', 'JPEG', 'BitDepth', 16);
