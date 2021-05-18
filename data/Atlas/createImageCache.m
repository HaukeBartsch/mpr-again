
cd('/Users/hauke/src/mpr-again/data/Atlas');
%%addpath('/Users/hauke/src/mpr-again/converter/niftimatlib-1.2/matlab');
addpath('/usr/local/fsl/etc/matlab/');

% we might be able to resize the volume
% fslreorient2std Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70.nii.gz
% flirt -in Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70.nii.gz \
% -ref Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70.nii.gz \
% -applyisoxfm 0.5 -nosearch -out Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70_512x512x512.nii.gz 

%data = read_avw('../data/Landman_1399_20110819_366886505_301_WIP_T1_3D_TFE_iso0_70_SENSE_T1_3D_TFE_iso0_70_512x512x512.nii');
%data = read_avw('../data/Landman_1399_20110819_366886505_501_WIP_T2_TRA_GRASE_SENSE_T2_TRA_GRASE_512x512x512.nii');
%data = read_avw('../data/Atlas.nii');
data = load('T1_pauli_atlas.mat');
data = data.vol_T1.imgs;

% Unit voxel size? Need to do the right thing here
%data = squeeze(data(:,:,:,1));
d = [200,200,260];  % do we need to do this????
name = "T1Atlas";
%data = imresize3(data,d);
% this will flip left and right, rot180 would be better
imagesc(flipud(data(:,:,100)')); axis equal; axis off; colormap(gray);

d = size(data);
numImages = ceil(sqrt(d(3)));
% we will have a single image with ceil(sqrt(512*512*512))
d2d = [numImages * d(1), numImages * d(2)];
data2d = uint16(zeros(d2d));

% one problem is HDR - we got 16bit data but we only have 8 bit display
% in a jpeg we have 8bit only
h = 1; w = 1;
for i=1:d(3)
   im = squeeze(data(:,:,i));
   %data2d(w:(w+d(1)-1), h:(h+d(2)-1)) = rot90(im,1);
   data2d(w:(w+d(1)-1), h:(h+d(2)-1)) = im;
   if (w+d(1)-1) >= d2d(1),
       w = 1;
       h = h + d(2);
   else
       w = w + d(1);
   end
end
data2d8bit = uint8(double(data2d)/double(max(max(data2d))) * (2^8-1));
data2d16bit = uint16(data2d);
imwrite(data2d16bit, strcat(name, 'Coronal.png'), 'PNG', 'BitDepth', 16);
%imwrite(data2d, 'T1Axial.jp2', 'jp2', 'Mode', 'lossy', 'CompressionRatio', 3);
imwrite(data2d8bit, strcat(name, 'Coronal.jpg'), 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 75);

numImages = ceil(sqrt(d(2)));
d2d = [numImages * d(1), numImages * d(3)];
data2d = uint16(zeros(d2d));
h = 1; w = 1;
for i=1:d(2)
   im = squeeze(data(:,i,:));
   %data2d(w:(w+d(1)-1), h:(h+d(2)-1)) = rot90(im,1);
   data2d(w:(w+d(1)-1), h:(h+d(3)-1)) = im;
   if (w+d(1)-1) >= d2d(1),
       w = 1;
       h = h + d(3);
   else
       w = w + d(1);
   end
end
data2d8bit = uint8(double(data2d)/double(max(max(data2d))) * (2^8-1));
data2d16bit = uint16(data2d);
imwrite(data2d16bit, strcat(name, 'Sagittal.png'), 'PNG', 'BitDepth', 16);
imwrite(data2d8bit, strcat(name, 'Sagittal.jpg'), 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 75);

numImages = ceil(sqrt(d(1)));
d2d = [numImages * d(3), numImages * d(2)];
data2d = uint16(zeros(d2d));
h = 1; w = 1;
for i=1:d(1)
   im = squeeze(data(i,:,:));
   data2d(w:(w+d(3)-1), h:(h+d(2)-1)) = rot90(im,1);
   if (w+d(3)-1) >= d2d(1),
       w = 1;
       h = h + d(2);
   else
       w = w + d(3);
   end
end
data2d8bit = uint8(double(data2d)/double(max(max(data2d))) * (2^8-1));
data2d16bit = uint16(data2d);
imwrite(data2d16bit, strcat(name, 'Axial.png'), 'PNG', 'BitDepth', 16);
imwrite(data2d8bit, strcat(name, 'Axial.jpg'), 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 100);

% imwrite(data2d, 'output.jpg', 'JPEG', 'BitDepth', 16);


% try to read in the vertex wise data from the folder
f = '/Users/hauke/src/mpr-again/data/SSE_examples/SSE_results/voxelwise';
data = read_avw(strcat(f, '/SSE_results_voxelwise_ND_beta_hat.nii'));
channel = 9; % up to 55 in there
data = squeeze(data(:,:,:,channel));
% figure, imagesc(data(:,:,60)); colormap(gray); axis equal; axis off;

% is 100x100x130 by default
d = [200,200,260];  % do we need to do this????
name = "ND_beta_hat";
%data = imresize3(data,d); % original resolution is 100,100,130
data = upsample_volume(data); % new resolution is twice the old resolution

%data2d = single(zeros(d2d));

numImages = ceil(sqrt(d(1)));
d2d = [numImages * d(3), numImages * d(2)];
data2d = single(zeros(d2d));
h = 1; w = 1;
for i=1:d(1)
   im = squeeze(data(i,:,:));
   data2d(w:(w+d(3)-1), h:(h+d(2)-1)) = rot90(im,1);
   if (w+d(3)-1) >= d2d(1),
       w = 1;
       h = h + d(2);
   else
       w = w + d(3);
   end
end
data2d8bit = uint8((double(data2d)-min(min(data2d)))/double(max(max(data2d))-min(min(data2d))) * (2^8-1));
imwrite(data2d8bit, strcat(name, 'Axial.jpg'), 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 75);
%data2d8bit = uint8(double(data2d)/double(max(max(data2d))) * (2^8-1));
%data2d16bit = uint16(data2d);
%imwrite(data2d16bit, strcat(name, 'Axial.png'), 'PNG', 'BitDepth', 16);
%imwrite(data2d8bit, strcat(name, 'Axial.jpg'), 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 75);
fileID = fopen(strcat(name, 'Axial_', num2str(channel, '%02d'), '_', num2str(d, "%d_"), 'single.dat'),'w');
fwrite(fileID,data2d','single');
fclose(fileID);

%h = 1; w = 1;
%for i=1:d(1)
%   im = squeeze(data(i,:,:));
%   data2d(w:(w+d(1)-1), h:(h+d(2)-1)) = rot90(im,1);
%   if (w+d(1)-1) >= d2d(1),
%       w = 1;
%       h = h + d(2);
%   else
%       w = w + d(1);
%   end
%end
% this is just for illustration, we cannot use this if we don't know at
% least the min value (to recover 0) or slope and intercept
%data2d8bit = uint8((double(data2d)-min(min(data2d)))/double(max(max(data2d))-min(min(data2d))) * (2^8-1));
%imwrite(data2d8bit, strcat(name, 'Axial.jpg'), 'jpeg', 'Mode', 'lossy', 'BitDepth', 8, 'Quality', 75);
% We should write this as a float field as well - we can read those on the
% website at full numerical precission.
%fileID = fopen(strcat(name, 'Axial_', num2str(channel, '%02d'), '_', num2str(d, "%d_"), 'single.dat'),'w');
%fwrite(fileID,data2d,'single');
%fclose(fileID);
% we can gzip this file (for each channel and its getting really small... )


% create the redblue colormap (white in the middle)
% m = 255;
%n = fix(0.5*m); 
%r = [(0:1:n-1)/n,ones(1,n)]; 
%g = [(0:n-1)/n, (n-1:-1:0)/n]; 
%b = [ones(1,n),(n-1:-1:0)/n]; 
%c = [r(:), g(:), b(:)];

% black in the middle
%function map = colormap_redblackblue()
%map=[1 1 0; 1 0.96 0; 1 0.92 0; 1 0.88 0; 1 0.84 0; 1 0.80 0; 1 0.76 0; 1 0.72 0; 1 0.68 0; 1 0.64 0; 1 0.60 0; 1 0.56 0; 1 0.52 0; 1 0.48 0; 1 0.44 0; 1 0.40 0;  ...
%             1 0.36 0; 1 0.32 0; 1 0.28 0; 1 0.24 0; 1 0.20 0; 1 0.16 0; 1 0.12 0; 1 0.08 0; 1 0.04 0;
%             1 0 0; 0.96 0 0; 0.92 0 0; 0.88 0 0; 0.84 0 0; 0.80 0 0; 0.76 0 0; 0.72 0 0; 0.68 0 0; 0.64 0 0; 0.60 0 0; 0.56 0 0; 0.52 0 0; 0.48 0 0; 0.44 0 0; 0.40 0 0;  ...
%             0.36 0 0; 0.32 0 0; 0.28 0 0; 0.24 0 0; 0.20 0 0; 0.16 0 0; 0.12 0 0; 0.08 0 0; 0.04 0 0; 0 0 0;                                   ...
%             0 0 0.04;  0 0 0.08; 0 0 0.12; 0 0 0.16; 0 0 0.20; 0 0 0.24; 0 0 0.28; 0 0 0.32; 0 0 0.36; 0 0 0.40; 0 0 0.44; 0 0 0.48; 0 0 0.52; ...
%             0 0 0.56; 0 0 0.60; 0 0 0.64; 0 0 0.68; 0 0 0.72; 0 0 0.76; 0 0 0.80; 0 0 0.84; 0 0 0.88; 0 0 0.92; 0 0 0.96; 0 0 1; ...
%             0 0.04 1;  0 0.08 1; 0 0.12 1; 0 0.16 1; 0 0.20 1; 0 0.24 1; 0 0.28 1; 0 0.32 1; 0 0.36 1; 0 0.40 1; 0 0.44 1; 0 0.48 1; 0 0.52 1; ...
%             0 0.56 1; 0 0.60 1; 0 0.64 1; 0 0.68 1; 0 0.72 1; 0 0.76 1; 0 0.80 1; 0 0.84 1; 0 0.88 1; 0 0.92 1; 0 0.96 1; 0 1 1];

%%
%% export the atlas ASEG as a volume we can read in the web-browser (compressed)
%% (todo: store using zlib to get from 12MB to 5MB)
% load('showVolAtlases_1mm.mat')
% mkdir('webASEG');
% b = struct( 'dims', aseg.prob{1}, 'indices', 'webASEG/indices.raw', 'probs', 'webASEG/probs.raw', 'roicodes', aseg.uiRoiIdx, 'roinames', {aseg.uiNames})
% fid = fopen('webASEG.json', 'w'); fprintf(fid, '%s', jsonencode(b)); fclose(fid);
% fid = fopen('webASEG/indices.raw', 'w'); fwrite(fid, aseg.prob{2}, 'uint32'); fclose(fid);
% fid = fopen('webASEG/probs.raw', 'w'); fwrite(fid, aseg.prob{3}, 'float32'); fclose(fid);



